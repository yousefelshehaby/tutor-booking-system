-- ============================================================================
-- Account statement upgrade: the student-facing monthly page becomes a
-- full "كشف حساب" (statement) instead of just a bare list of unpaid
-- months. get_monthly_payment_status now also returns when/how each
-- paid month was settled, and a new RPC surfaces the booking-level
-- summary (student/group/schedule + the initial booking fee) needed for
-- the header. Range-of-months and "read-only even when payments are
-- closed" logic live entirely in the app layer on top of these.
-- ============================================================================

drop function if exists get_monthly_payment_status(uuid);

create or replace function get_monthly_payment_status(p_booking_id uuid)
returns table (
  month text,
  is_paid boolean,
  amount numeric,
  paid_at timestamptz,
  payment_method payment_method
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
  v_mp monthly_payments%rowtype;
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

    select * into v_mp from monthly_payments mp
      where mp.booking_id = p_booking_id
        and mp.month = v_month_text
        and mp.payment_status = 'paid'
      limit 1;

    return query
      select
        v_month_text,
        found,
        coalesce(v_group.monthly_fee, v_group.price),
        v_mp.paid_at,
        v_mp.payment_method;

    v_cursor := (v_cursor + interval '1 month')::date;
  end loop;
end;
$$;

grant execute on function get_monthly_payment_status(uuid) to anon, authenticated;

create or replace function get_account_statement_header(p_booking_id uuid)
returns table (
  student_name text,
  grade_name text,
  group_name text,
  group_days text,
  group_time text,
  booking_amount numeric,
  booking_payment_status payment_status,
  booking_payment_method payment_method,
  booking_paid_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    b.student_name,
    gr.name,
    gp.name,
    gp.days,
    gp."time",
    b.amount,
    b.payment_status,
    b.payment_method,
    b.paid_at
  from bookings b
  join grades gr on gr.id = b.grade_id
  join groups gp on gp.id = b.group_id
  where b.id = p_booking_id;
$$;

grant execute on function get_account_statement_header(uuid) to anon, authenticated;
