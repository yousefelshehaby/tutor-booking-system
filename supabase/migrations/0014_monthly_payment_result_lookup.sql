-- ============================================================================
-- The payment result page previously only looked up bookings by
-- booking_code — Paymob's redirect for a MONTHLY fee payment carries
-- merchant_order_id = "MP-<monthly_payments.id>", which never matches a
-- booking_code. Students paying a monthly fee by card/wallet always landed
-- on a "couldn't find this transaction" page even when the payment (and
-- the underlying webhook update) succeeded. This RPC lets the result page
-- resolve that case too.
-- ============================================================================

create or replace function get_monthly_payment_by_id(p_id uuid)
returns table (
  student_name text,
  month text,
  amount numeric,
  payment_method payment_method,
  payment_status payment_status,
  booking_code text,
  grade_name text,
  group_name text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    b.student_name,
    mp.month,
    mp.amount,
    mp.payment_method,
    mp.payment_status,
    b.booking_code,
    gr.name as grade_name,
    gp.name as group_name
  from monthly_payments mp
  join bookings b on b.id = mp.booking_id
  join grades gr on gr.id = b.grade_id
  join groups gp on gp.id = b.group_id
  where mp.id = p_id;
$$;

grant execute on function get_monthly_payment_by_id(uuid) to anon, authenticated;
