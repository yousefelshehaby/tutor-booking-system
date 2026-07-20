-- ============================================================================
-- Fix: found live while testing the move-student feature. admin_users.name
-- is null for every tutor/super_admin account in production (it's only
-- ever populated for TAs, via the ta_requests workflow) — so
-- move_booking_to_group's `coalesce(v_caller_name, 'مدير النظام')`
-- fallback fired for every tutor-initiated move, wrongly attributing it
-- to "مدير النظام" (the system admin) instead of the tutor who actually
-- did it. Fix: when the caller is a tutor, look up their real display
-- name from tutors.name (well-populated) instead of admin_users.name.
-- ============================================================================

create or replace function move_booking_to_group(p_booking_id uuid, p_new_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text;
  v_caller_tutor_id uuid;
  v_actor_label text;
  v_booking bookings%rowtype;
  v_old_group_name text;
  v_new_group groups%rowtype;
  v_active_count int;
  v_note text;
begin
  select admin_users.role, admin_users.tutor_id
    into v_caller_role, v_caller_tutor_id
  from admin_users where admin_users.id = auth.uid() and admin_users.is_active = true;

  if v_caller_role is null or v_caller_role = 'ta' then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  select * into v_booking from bookings where bookings.id = p_booking_id for update;
  if not found or v_booking.archived_at is not null then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_caller_role <> 'super_admin' and v_caller_tutor_id <> v_booking.tutor_id then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  select groups.name into v_old_group_name from groups where groups.id = v_booking.group_id;

  select * into v_new_group from groups where groups.id = p_new_group_id for update;
  if not found or v_new_group.is_active = false or v_new_group.tutor_id <> v_booking.tutor_id then
    raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_new_group.grade_id <> v_booking.grade_id then
    raise exception 'GRADE_MISMATCH' using errcode = 'P0001';
  end if;

  if v_new_group.id = v_booking.group_id then
    raise exception 'SAME_GROUP' using errcode = 'P0001';
  end if;

  select count(*) into v_active_count
  from bookings
  where bookings.group_id = p_new_group_id
    and bookings.id <> p_booking_id
    and bookings.archived_at is null
    and (
      bookings.payment_status = 'paid'
      or (
        bookings.payment_status = 'pending'
        and (bookings.payment_method <> 'reserve_only' or bookings.expires_at > now())
      )
    );

  if v_active_count >= v_new_group.capacity then
    raise exception 'GROUP_FULL' using errcode = 'P0001';
  end if;

  update bookings set group_id = p_new_group_id where bookings.id = p_booking_id;

  if v_caller_role = 'super_admin' then
    v_actor_label := 'مدير النظام';
  else
    select tutors.name into v_actor_label from tutors where tutors.id = v_caller_tutor_id;
    v_actor_label := coalesce(v_actor_label, 'المدرّس');
  end if;

  v_note := format(
    'تم النقل من مجموعة %s إلى مجموعة %s بواسطة %s',
    coalesce(v_old_group_name, 'غير معروف'),
    v_new_group.name,
    v_actor_label
  );

  insert into student_notes (booking_id, tutor_id, created_by, note)
  values (p_booking_id, v_booking.tutor_id, auth.uid(), v_note);

  if v_caller_role = 'super_admin' then
    insert into notifications (tutor_id, recipient_admin_id, type, message)
    select
      v_booking.tutor_id,
      admin_users.id,
      'student_moved',
      format(
        'تم نقل %s من مجموعة %s إلى مجموعة %s بواسطة مدير النظام',
        v_booking.student_name, coalesce(v_old_group_name, '-'), v_new_group.name
      )
    from admin_users
    where admin_users.tutor_id = v_booking.tutor_id
      and admin_users.role = 'tutor'
      and admin_users.is_active = true;
  end if;

  update waitlist_requests
  set status = 'converted', converted_booking_id = p_booking_id
  where waitlist_requests.group_id = p_new_group_id
    and waitlist_requests.student_phone = v_booking.student_phone
    and waitlist_requests.status = 'waiting';
end;
$$;

grant execute on function move_booking_to_group(uuid, uuid) to authenticated;
