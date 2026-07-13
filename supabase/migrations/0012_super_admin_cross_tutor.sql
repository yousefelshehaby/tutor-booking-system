-- ============================================================================
-- get_monthly_payment_matrix now also returns tutor_id/tutor_name, so the
-- super admin's cross-tutor bookings/monthly-payments views can filter and
-- label by tutor. No RLS change needed here — the function already runs
-- with the caller's own privileges (not SECURITY DEFINER), so a super_admin
-- caller already sees every tutor's rows via the existing
-- admin_has_tutor_access() policies; a tutor/ta caller still only sees
-- their own, unchanged.
-- ============================================================================

drop function if exists get_monthly_payment_matrix(text);

create or replace function get_monthly_payment_matrix(p_month text)
returns table (
  booking_id uuid,
  booking_code text,
  student_name text,
  student_phone text,
  tutor_id uuid,
  tutor_name text,
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
    t.id,
    t.name,
    gr.id,
    gr.name,
    gp.id,
    gp.name,
    coalesce(gp.monthly_fee, gp.price),
    coalesce(mp.payment_status = 'paid', false),
    mp.id
  from bookings b
  join tutors t on t.id = b.tutor_id
  join grades gr on gr.id = b.grade_id
  join groups gp on gp.id = b.group_id
  left join monthly_payments mp on mp.booking_id = b.id and mp.month = p_month
  where b.payment_status = 'paid';
$$;

grant execute on function get_monthly_payment_matrix(text) to authenticated;
