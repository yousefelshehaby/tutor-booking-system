-- ============================================================================
-- find_eligible_bookings needs to return student_phone too — the student
-- payment flow needs it for Paymob billing data regardless of whether the
-- student looked their booking up by code or by phone.
-- ============================================================================

drop function if exists find_eligible_bookings(uuid, text, text);

create or replace function find_eligible_bookings(
  p_tutor_id uuid,
  p_code text default null,
  p_phone text default null
)
returns table (
  booking_id uuid,
  booking_code text,
  student_name text,
  student_phone text,
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
    b.student_phone,
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
-- get_monthly_payment_matrix also needs grade_id/group_id so the admin page
-- can filter by grade/group, not just display names.
-- ----------------------------------------------------------------------------

drop function if exists get_monthly_payment_matrix(text);

create or replace function get_monthly_payment_matrix(p_month text)
returns table (
  booking_id uuid,
  booking_code text,
  student_name text,
  student_phone text,
  grade_id uuid,
  grade_name text,
  group_id uuid,
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
    gr.id,
    gr.name,
    gp.id,
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
