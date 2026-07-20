-- ============================================================================
-- Move a student to a different group (same grade, same tutor). Staff-only
-- (tutor/super_admin, not ta) — mirrors create_booking's exact seat-lock
-- shape for the destination group so a move can never push it over
-- capacity, even under concurrent requests.
--
-- Deliberately `returns void` (no RETURNS TABLE) — the previous
-- promote_waitlist_entry migration (0027/0028) hit a real bug where a
-- RETURNS TABLE column happened to share a name with a plain column
-- referenced unqualified in the body ("tutor_id is ambiguous"). Nothing
-- here needs to return data back to the caller, so avoiding that shape
-- entirely sidesteps the whole class of bug.
-- ============================================================================

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'student_note',
    'ta_request_submitted',
    'ta_request_resolved',
    'waitlist_request_submitted',
    'waitlist_seat_available',
    'feedback_message_submitted',
    'student_moved'
  ));

create or replace function move_booking_to_group(p_booking_id uuid, p_new_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text;
  v_caller_tutor_id uuid;
  v_caller_name text;
  v_booking bookings%rowtype;
  v_old_group_name text;
  v_new_group groups%rowtype;
  v_active_count int;
  v_note text;
begin
  select admin_users.role, admin_users.tutor_id, admin_users.name
    into v_caller_role, v_caller_tutor_id, v_caller_name
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

  v_note := format(
    'تم النقل من مجموعة %s إلى مجموعة %s بواسطة %s',
    coalesce(v_old_group_name, 'غير معروف'),
    v_new_group.name,
    coalesce(v_caller_name, 'مدير النظام')
  );

  insert into student_notes (booking_id, tutor_id, created_by, note)
  values (p_booking_id, v_booking.tutor_id, auth.uid(), v_note);

  -- Notify the tutor only when a super admin performed the move — a tutor
  -- moving their own student doesn't need to be told about their own action.
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

  -- If this student is on the destination group's waitlist, they now have
  -- a real seat there — mark that entry converted instead of leaving it
  -- stuck as "waiting" for a group they're already in.
  update waitlist_requests
  set status = 'converted', converted_booking_id = p_booking_id
  where waitlist_requests.group_id = p_new_group_id
    and waitlist_requests.student_phone = v_booking.student_phone
    and waitlist_requests.status = 'waiting';
end;
$$;

grant execute on function move_booking_to_group(uuid, uuid) to authenticated;
