-- ============================================================================
-- Phase 7: monthly subscription payments
--
-- `settings` is one row per tutor controlling whether new bookings and/or
-- monthly payments are currently open, and which month is "current" for
-- collection purposes. `monthly_payments` records one payment per
-- (booking, month) — the unique constraint is what makes double-paying a
-- month structurally impossible, not just an app-level check.
-- ============================================================================

create table settings (
  tutor_id uuid primary key references tutors (id) on delete cascade,
  booking_open boolean not null default true,
  monthly_payment_open boolean not null default true,
  current_month text not null default to_char(now(), 'YYYY-MM')
);

insert into settings (tutor_id)
select id from tutors where slug = 'default'
on conflict (tutor_id) do nothing;

alter table settings enable row level security;

create policy "public can read settings of active tutors"
  on settings for select
  to anon
  using (is_tutor_active(tutor_id));

create policy "tutor admin manages own settings"
  on settings for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = settings.tutor_id)
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = settings.tutor_id)
    )
  );

-- ----------------------------------------------------------------------------
-- monthly_payments
-- ----------------------------------------------------------------------------

create table monthly_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  tutor_id uuid not null references tutors (id) on delete cascade,
  month text not null,
  amount numeric(10, 2) not null,
  payment_method payment_method not null,
  payment_status payment_status not null default 'pending',
  paymob_order_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, month)
);

create index idx_monthly_payments_booking_id on monthly_payments (booking_id);
create index idx_monthly_payments_tutor_id on monthly_payments (tutor_id);
create index idx_monthly_payments_month on monthly_payments (month);

alter table monthly_payments enable row level security;
-- No anon policy at all: public reads/writes go through the SECURITY
-- DEFINER functions below, same pattern as bookings.

create policy "tutor admin manages own monthly payments"
  on monthly_payments for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = monthly_payments.tutor_id)
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = monthly_payments.tutor_id)
    )
  );

-- ----------------------------------------------------------------------------
-- find_eligible_bookings: student enters a booking code OR a phone number.
-- Only bookings whose original payment is already 'paid' are eligible for
-- monthly payments (matches the spec's "original paid status" rule).
-- ----------------------------------------------------------------------------

create or replace function find_eligible_bookings(
  p_tutor_id uuid,
  p_code text default null,
  p_phone text default null
)
returns table (
  booking_id uuid,
  booking_code text,
  student_name text,
  grade_name text,
  group_name text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    b.booking_code,
    b.student_name,
    gr.name,
    gp.name
  from bookings b
  join grades gr on gr.id = b.grade_id
  join groups gp on gp.id = b.group_id
  where b.tutor_id = p_tutor_id
    and b.payment_status = 'paid'
    and (
      (p_code is not null and b.booking_code = p_code)
      or (p_phone is not null and (b.student_phone = p_phone or b.guardian_phone = p_phone))
    );
$$;

grant execute on function find_eligible_bookings(uuid, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- get_monthly_payment_status: months from the booking's enrollment month
-- (the month it was created) through the tutor's current_month, each with
-- paid/unpaid status and the amount due.
-- ----------------------------------------------------------------------------

create or replace function get_monthly_payment_status(p_booking_id uuid)
returns table (
  month text,
  is_paid boolean,
  amount numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking bookings%rowtype;
  v_group groups%rowtype;
  v_current_month text;
  v_cursor date;
  v_end date;
  v_month_text text;
begin
  select * into v_booking from bookings where bookings.id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_group from groups where groups.id = v_booking.group_id;

  select settings.current_month into v_current_month
  from settings where settings.tutor_id = v_booking.tutor_id;

  if v_current_month is null then
    v_current_month := to_char(now(), 'YYYY-MM');
  end if;

  v_cursor := to_date(to_char(v_booking.created_at, 'YYYY-MM') || '-01', 'YYYY-MM-DD');
  v_end := to_date(v_current_month || '-01', 'YYYY-MM-DD');

  while v_cursor <= v_end loop
    v_month_text := to_char(v_cursor, 'YYYY-MM');

    return query
      select
        v_month_text,
        exists (
          select 1 from monthly_payments mp
          where mp.booking_id = p_booking_id
            and mp.month = v_month_text
            and mp.payment_status = 'paid'
        ),
        coalesce(v_group.monthly_fee, v_group.price);

    v_cursor := (v_cursor + interval '1 month')::date;
  end loop;
end;
$$;

grant execute on function get_monthly_payment_status(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- pay_monthly_fee: creates (or reuses, for a retry) a pending monthly
-- payment row. The (booking_id, month) unique constraint plus the explicit
-- ALREADY_PAID check make it structurally impossible to double-pay a month.
-- ----------------------------------------------------------------------------

create or replace function pay_monthly_fee(
  p_tutor_id uuid,
  p_booking_id uuid,
  p_month text,
  p_payment_method payment_method
)
returns table (
  id uuid,
  amount numeric,
  merchant_order_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking bookings%rowtype;
  v_group groups%rowtype;
  v_existing monthly_payments%rowtype;
  v_amount numeric;
  v_new_id uuid;
begin
  select * into v_booking from bookings where bookings.id = p_booking_id;
  if not found or v_booking.tutor_id <> p_tutor_id then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_booking.payment_status <> 'paid' then
    raise exception 'BOOKING_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  select * into v_group from groups where groups.id = v_booking.group_id;
  v_amount := coalesce(v_group.monthly_fee, v_group.price);

  select * into v_existing from monthly_payments
    where monthly_payments.booking_id = p_booking_id and monthly_payments.month = p_month
    for update;

  if found then
    if v_existing.payment_status = 'paid' then
      raise exception 'ALREADY_PAID' using errcode = 'P0001';
    end if;

    update monthly_payments
      set payment_method = p_payment_method
      where monthly_payments.id = v_existing.id;
    v_new_id := v_existing.id;
  else
    insert into monthly_payments (booking_id, tutor_id, month, amount, payment_method, payment_status)
    values (p_booking_id, p_tutor_id, p_month, v_amount, p_payment_method, 'pending')
    returning monthly_payments.id into v_new_id;
  end if;

  return query
    select v_new_id, v_amount, 'MP-' || v_new_id::text;
end;
$$;

grant execute on function pay_monthly_fee(uuid, uuid, text, payment_method) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- get_monthly_payment_matrix: admin-facing. Runs with the caller's own
-- privileges (no SECURITY DEFINER) so RLS naturally scopes every joined
-- table to the logged-in admin's own tutor — no explicit tutor_id parameter
-- needed.
-- ----------------------------------------------------------------------------

create or replace function get_monthly_payment_matrix(p_month text)
returns table (
  booking_id uuid,
  booking_code text,
  student_name text,
  student_phone text,
  grade_name text,
  group_name text,
  amount numeric,
  is_paid boolean,
  monthly_payment_id uuid
)
language sql
set search_path = public, pg_temp
as $$
  select
    b.id,
    b.booking_code,
    b.student_name,
    b.student_phone,
    gr.name,
    gp.name,
    coalesce(gp.monthly_fee, gp.price),
    coalesce(mp.payment_status = 'paid', false),
    mp.id
  from bookings b
  join grades gr on gr.id = b.grade_id
  join groups gp on gp.id = b.group_id
  left join monthly_payments mp on mp.booking_id = b.id and mp.month = p_month
  where b.payment_status = 'paid';
$$;

grant execute on function get_monthly_payment_matrix(text) to authenticated;
