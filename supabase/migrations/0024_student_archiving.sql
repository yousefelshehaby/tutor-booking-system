-- ============================================================================
-- Student archiving (soft delete): a tutor/super_admin can "delete" a
-- student — the booking row (and its monthly_payments/student_notes
-- history) is NEVER physically removed, just marked archived. Every RPC
-- that (a) counts active seats, (b) resolves a phone/code to a booking
-- for the public flows, or (c) lists "active" students for the admin
-- panel, is updated to exclude archived rows. Archiving itself is a
-- plain UPDATE already covered by the existing "tutor and super admin
-- manage own bookings" RLS policy (which is why TAs — who only ever got
-- a SELECT policy on bookings — can never archive/restore); no RLS
-- changes needed for that part.
-- ============================================================================

alter table bookings add column archived_at timestamptz;
alter table bookings add column archived_by uuid references admin_users (id) on delete set null;

create index idx_bookings_archived_at on bookings (archived_at);

-- ----------------------------------------------------------------------------
-- Seat-counting: get_groups_with_availability + create_booking
-- ----------------------------------------------------------------------------

create or replace function get_groups_with_availability(p_tutor_id uuid, p_grade_id uuid)
returns table (
  id uuid,
  name text,
  days text,
  "time" text,
  price numeric,
  capacity int,
  remaining_seats int
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    g.id,
    g.name,
    g.days,
    g.time,
    g.price,
    g.capacity,
    greatest(g.capacity - coalesce(b.active_count, 0), 0)::int as remaining_seats
  from groups g
  left join (
    select
      group_id,
      count(*) as active_count
    from bookings
    where archived_at is null
      and (
        payment_status = 'paid'
        or (payment_status = 'pending' and (payment_method <> 'reserve_only' or expires_at > now()))
      )
    group by group_id
  ) b on b.group_id = g.id
  where g.grade_id = p_grade_id
    and g.tutor_id = p_tutor_id
    and g.is_active = true
  order by g.created_at;
$$;

grant execute on function get_groups_with_availability(uuid, uuid) to anon, authenticated;

create or replace function create_booking(
  p_tutor_id uuid,
  p_student_name text,
  p_student_phone text,
  p_guardian_phone text,
  p_grade_id uuid,
  p_group_id uuid,
  p_payment_method payment_method
)
returns table (
  id uuid,
  booking_code text,
  amount numeric,
  expires_at timestamptz,
  tutor_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group groups%rowtype;
  v_grade_active boolean;
  v_grade_tutor uuid;
  v_tutor_active boolean;
  v_active_count int;
  v_booking_code text;
  v_expires_at timestamptz;
  v_new_id uuid;
begin
  perform expire_stale_reservations();

  select tutors.is_active into v_tutor_active from tutors where tutors.id = p_tutor_id;
  if not found or v_tutor_active = false then
    raise exception 'TUTOR_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_group from groups where groups.id = p_group_id for update;
  if not found or v_group.is_active = false then
    raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_group.tutor_id <> p_tutor_id then
    raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_group.grade_id <> p_grade_id then
    raise exception 'GROUP_GRADE_MISMATCH' using errcode = 'P0001';
  end if;

  select grades.is_active, grades.tutor_id into v_grade_active, v_grade_tutor
  from grades where grades.id = p_grade_id;
  if not found or v_grade_active = false or v_grade_tutor <> p_tutor_id then
    raise exception 'GRADE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select count(*) into v_active_count
  from bookings
  where bookings.group_id = p_group_id
    and bookings.archived_at is null
    and (
      bookings.payment_status = 'paid'
      or (
        bookings.payment_status = 'pending'
        and (bookings.payment_method <> 'reserve_only' or bookings.expires_at > now())
      )
    );

  if v_active_count >= v_group.capacity then
    raise exception 'GROUP_FULL' using errcode = 'P0001';
  end if;

  v_booking_code := generate_booking_code();

  if p_payment_method = 'reserve_only' then
    v_expires_at := now() + interval '48 hours';
  else
    v_expires_at := null;
  end if;

  insert into bookings (
    booking_code, student_name, student_phone, guardian_phone,
    grade_id, group_id, tutor_id, payment_method, payment_status, amount, expires_at
  ) values (
    v_booking_code, p_student_name, p_student_phone, p_guardian_phone,
    p_grade_id, p_group_id, p_tutor_id, p_payment_method, 'pending', v_group.price, v_expires_at
  )
  returning bookings.id into v_new_id;

  return query
    select v_new_id, v_booking_code, v_group.price, v_expires_at, p_tutor_id;
end;
$$;

grant execute on function create_booking(uuid, text, text, text, uuid, uuid, payment_method) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- expire_stale_reservations: skip archived rows (nothing to expire on a
-- student that's already been removed from active views).
-- ----------------------------------------------------------------------------

create or replace function expire_stale_reservations()
returns void
language sql
set search_path = public, pg_temp
as $$
  update bookings
  set payment_status = 'expired'
  where payment_method = 'reserve_only'
    and payment_status = 'pending'
    and archived_at is null
    and expires_at is not null
    and expires_at < now();
$$;

-- ----------------------------------------------------------------------------
-- Public resolution flows: an archived booking must never resolve a
-- phone/code back to the student — they're treated as brand new.
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
    and b.archived_at is null
    and (
      (p_code is not null and b.booking_code = p_code)
      or (p_phone is not null and (b.student_phone = p_phone or b.guardian_phone = p_phone))
    );
$$;

grant execute on function find_eligible_bookings(uuid, text, text) to anon, authenticated;

create or replace function find_active_reservation(p_tutor_id uuid, p_phone text)
returns table (
  booking_id uuid,
  booking_code text,
  student_name text,
  payment_method payment_method,
  amount numeric,
  expires_at timestamptz,
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
    b.payment_method,
    b.amount,
    b.expires_at,
    gr.name,
    gp.name
  from bookings b
  join grades gr on gr.id = b.grade_id
  join groups gp on gp.id = b.group_id
  where b.tutor_id = p_tutor_id
    and (b.student_phone = p_phone or b.guardian_phone = p_phone)
    and b.payment_status = 'pending'
    and b.archived_at is null
    and (b.payment_method <> 'reserve_only' or b.expires_at > now())
  order by b.created_at desc
  limit 1;
$$;

grant execute on function find_active_reservation(uuid, text) to anon, authenticated;

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
  where (b.student_phone = p_phone or b.guardian_phone = p_phone)
    and b.archived_at is null
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
  select
    'booking_created' as event_type,
    b.created_at as event_date,
    t.name as tutor_name,
    gp.name as description
  from bookings b
  join tutors t on t.id = b.tutor_id and t.is_active = true
  join groups gp on gp.id = b.group_id
  where (b.student_phone = p_phone or b.guardian_phone = p_phone)
    and b.archived_at is null

  union all

  select 'booking_paid', b.paid_at, t.name, 'رسوم الحجز'
  from bookings b
  join tutors t on t.id = b.tutor_id and t.is_active = true
  where (b.student_phone = p_phone or b.guardian_phone = p_phone)
    and b.archived_at is null
    and b.payment_status = 'paid' and b.paid_at is not null

  union all

  select 'monthly_paid', mp.paid_at, t.name, mp.month
  from monthly_payments mp
  join bookings b on b.id = mp.booking_id
  join tutors t on t.id = b.tutor_id and t.is_active = true
  where (b.student_phone = p_phone or b.guardian_phone = p_phone)
    and b.archived_at is null
    and mp.payment_status = 'paid' and mp.paid_at is not null

  order by event_date desc
  limit 30;
$$;

grant execute on function get_student_recent_activity(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Admin monthly-payments matrix: archived students stop generating dues.
-- ----------------------------------------------------------------------------

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
  where b.payment_status = 'paid'
    and b.archived_at is null;
$$;

grant execute on function get_monthly_payment_matrix(text) to authenticated;

-- ----------------------------------------------------------------------------
-- restore_booking: un-archives, but only if the group still has a free
-- seat (mirrors create_booking's own capacity check/locking exactly, so
-- a restore can never push a group over capacity).
-- ----------------------------------------------------------------------------

create or replace function restore_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking bookings%rowtype;
  v_group groups%rowtype;
  v_caller_role text;
  v_caller_tutor_id uuid;
  v_active_count int;
begin
  select role, tutor_id into v_caller_role, v_caller_tutor_id
  from admin_users where admin_users.id = auth.uid() and admin_users.is_active = true;

  if v_caller_role is null or v_caller_role = 'ta' then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  select * into v_booking from bookings where bookings.id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_caller_role <> 'super_admin' and v_caller_tutor_id <> v_booking.tutor_id then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  if v_booking.archived_at is null then
    raise exception 'NOT_ARCHIVED' using errcode = 'P0001';
  end if;

  select * into v_group from groups where groups.id = v_booking.group_id for update;

  select count(*) into v_active_count
  from bookings
  where bookings.group_id = v_booking.group_id
    and bookings.id <> v_booking.id
    and bookings.archived_at is null
    and (
      bookings.payment_status = 'paid'
      or (
        bookings.payment_status = 'pending'
        and (bookings.payment_method <> 'reserve_only' or bookings.expires_at > now())
      )
    );

  if v_active_count >= v_group.capacity then
    raise exception 'GROUP_FULL' using errcode = 'P0001';
  end if;

  update bookings set archived_at = null, archived_by = null where bookings.id = p_booking_id;
end;
$$;

grant execute on function restore_booking(uuid) to authenticated;
