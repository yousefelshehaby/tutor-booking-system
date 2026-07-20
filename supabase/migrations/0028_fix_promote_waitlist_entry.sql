-- ============================================================================
-- Fix: promote_waitlist_entry's `returns table (..., tutor_id uuid, ...)`
-- implicitly declares an OUT variable named `tutor_id` (same as
-- create_booking's return shape it mirrors). The caller-authorization
-- lookup then did `select role, tutor_id into ... from admin_users where
-- ...` with both columns unqualified — `tutor_id` is ambiguous between
-- that OUT variable and admin_users.tutor_id, causing every call to fail
-- with "42702: column reference tutor_id is ambiguous" (caught live while
-- testing the promote flow). restore_booking has the same-looking select
-- but RETURNS void, so it never hit this — only this function's TABLE
-- return type introduces the collision. Fix: qualify both columns.
-- ============================================================================

create or replace function promote_waitlist_entry(p_waitlist_id uuid)
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
  v_waitlist waitlist_requests%rowtype;
  v_group groups%rowtype;
  v_caller_role text;
  v_caller_tutor_id uuid;
  v_active_count int;
  v_booking_code text;
  v_expires_at timestamptz;
  v_new_id uuid;
begin
  select admin_users.role, admin_users.tutor_id into v_caller_role, v_caller_tutor_id
  from admin_users where admin_users.id = auth.uid() and admin_users.is_active = true;

  if v_caller_role is null or v_caller_role = 'ta' then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  select * into v_waitlist from waitlist_requests where waitlist_requests.id = p_waitlist_id for update;
  if not found then
    raise exception 'WAITLIST_ENTRY_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_caller_role <> 'super_admin' and v_caller_tutor_id <> v_waitlist.tutor_id then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  if v_waitlist.status <> 'waiting' then
    raise exception 'NOT_WAITING' using errcode = 'P0001';
  end if;

  select * into v_group from groups where groups.id = v_waitlist.group_id for update;

  select count(*) into v_active_count
  from bookings
  where bookings.group_id = v_waitlist.group_id
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
  v_expires_at := now() + interval '48 hours';

  insert into bookings (
    booking_code, student_name, student_phone, guardian_phone,
    grade_id, group_id, tutor_id, payment_method, payment_status, amount, expires_at
  ) values (
    v_booking_code, v_waitlist.student_name, v_waitlist.student_phone, v_waitlist.guardian_phone,
    v_waitlist.grade_id, v_waitlist.group_id, v_waitlist.tutor_id, 'reserve_only', 'pending',
    v_group.price, v_expires_at
  )
  returning bookings.id into v_new_id;

  update waitlist_requests
  set status = 'converted', converted_booking_id = v_new_id
  where waitlist_requests.id = p_waitlist_id;

  return query
    select v_new_id, v_booking_code, v_group.price, v_expires_at, v_waitlist.tutor_id;
end;
$$;

grant execute on function promote_waitlist_entry(uuid) to authenticated;
