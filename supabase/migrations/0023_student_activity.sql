-- ============================================================================
-- Cross-tutor student activity ("حسابي"): a student may work with more
-- than one tutor on this platform. These RPCs aggregate by PHONE across
-- every active tutor — deliberately returning no money amounts (only
-- statuses/months/dates), since this page is a directory-level summary,
-- not a payment surface. Full amounts stay behind each tutor's own
-- get_account_statement_header/get_monthly_payment_status, reached via
-- this page's "عرض كشف الحساب الكامل" link.
-- ============================================================================

create or replace function find_student_bookings_across_tutors(p_phone text)
returns table (
  booking_id uuid,
  tutor_id uuid,
  tutor_name text,
  tutor_slug text,
  tutor_photo_url text,
  grade_name text,
  group_name text,
  group_days text,
  group_time text,
  payment_status payment_status,
  booking_code text,
  created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    t.id,
    t.name,
    t.slug,
    t.photo_url,
    gr.name,
    gp.name,
    gp.days,
    gp."time",
    b.payment_status,
    b.booking_code,
    b.created_at
  from bookings b
  join tutors t on t.id = b.tutor_id and t.is_active = true
  join grades gr on gr.id = b.grade_id
  join groups gp on gp.id = b.group_id
  where b.student_phone = p_phone or b.guardian_phone = p_phone
  order by b.created_at desc;
$$;

grant execute on function find_student_bookings_across_tutors(text) to anon, authenticated;

create or replace function get_student_recent_activity(p_phone text)
returns table (
  event_type text,
  event_date timestamptz,
  tutor_name text,
  description text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select 'booking_created', b.created_at, t.name, gp.name
  from bookings b
  join tutors t on t.id = b.tutor_id and t.is_active = true
  join groups gp on gp.id = b.group_id
  where b.student_phone = p_phone or b.guardian_phone = p_phone

  union all

  select 'booking_paid', b.paid_at, t.name, 'رسوم الحجز'
  from bookings b
  join tutors t on t.id = b.tutor_id and t.is_active = true
  where (b.student_phone = p_phone or b.guardian_phone = p_phone)
    and b.payment_status = 'paid' and b.paid_at is not null

  union all

  select 'monthly_paid', mp.paid_at, t.name, mp.month
  from monthly_payments mp
  join bookings b on b.id = mp.booking_id
  join tutors t on t.id = b.tutor_id and t.is_active = true
  where (b.student_phone = p_phone or b.guardian_phone = p_phone)
    and mp.payment_status = 'paid' and mp.paid_at is not null

  order by event_date desc
  limit 30;
$$;

grant execute on function get_student_recent_activity(text) to anon, authenticated;
