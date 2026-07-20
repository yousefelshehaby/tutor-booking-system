-- ============================================================================
-- Suggestions & complaints box: a public feedback form (main directory
-- and each tutor's own page) that only super admins can ever see —
-- tutors/TAs must never have access, even to feedback attached to their
-- own tutor_id. Insert-only via a SECURITY DEFINER RPC (anon-facing,
-- same shape as join_waitlist/create_booking); no RLS policy grants
-- anon/tutor/ta anything on this table at all.
-- ============================================================================

create table feedback_messages (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid references tutors (id) on delete set null,
  sender_name text,
  sender_phone text,
  message_text text not null check (char_length(message_text) between 1 and 2000),
  status text not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now()
);

create index idx_feedback_messages_created_at on feedback_messages (created_at desc);
create index idx_feedback_messages_status on feedback_messages (status);

alter table feedback_messages enable row level security;

-- admin_has_tutor_access(tutor_id, array['super_admin']) works correctly
-- even when tutor_id is null (feedback submitted from the main directory,
-- not a specific tutor page): the function's own check is
-- `au.role = any(p_roles) and (au.role = 'super_admin' or au.tutor_id = p_tutor_id)`
-- — once role = 'super_admin' passes the first clause, the second is
-- satisfied unconditionally by `au.role = 'super_admin'`, regardless of
-- p_tutor_id. So this one policy correctly covers every row.
create policy "super admin manages feedback messages"
  on feedback_messages for all
  to authenticated
  using (admin_has_tutor_access(feedback_messages.tutor_id, array['super_admin']))
  with check (admin_has_tutor_access(feedback_messages.tutor_id, array['super_admin']));

-- ----------------------------------------------------------------------------
-- notifications: tutor_id must become nullable (feedback from the main
-- directory has none), and the type check widens for the new event.
-- ----------------------------------------------------------------------------

alter table notifications alter column tutor_id drop not null;

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'student_note',
    'ta_request_submitted',
    'ta_request_resolved',
    'waitlist_request_submitted',
    'waitlist_seat_available',
    'feedback_message_submitted'
  ));

create or replace function submit_feedback_message(
  p_tutor_id uuid,
  p_sender_name text,
  p_sender_phone text,
  p_message_text text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_tutor_name text;
  v_recipient record;
begin
  if p_message_text is null or length(trim(p_message_text)) = 0 then
    raise exception 'MESSAGE_REQUIRED' using errcode = 'P0001';
  end if;

  if length(p_message_text) > 2000 then
    raise exception 'MESSAGE_TOO_LONG' using errcode = 'P0001';
  end if;

  if p_tutor_id is not null then
    select tutors.name into v_tutor_name from tutors where tutors.id = p_tutor_id;
    if not found then
      raise exception 'TUTOR_NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  insert into feedback_messages (tutor_id, sender_name, sender_phone, message_text)
  values (
    p_tutor_id,
    nullif(trim(coalesce(p_sender_name, '')), ''),
    nullif(trim(coalesce(p_sender_phone, '')), ''),
    trim(p_message_text)
  )
  returning feedback_messages.id into v_id;

  for v_recipient in
    select admin_users.id from admin_users
    where admin_users.is_active = true and admin_users.role = 'super_admin'
  loop
    insert into notifications (tutor_id, recipient_admin_id, type, message)
    values (
      p_tutor_id, v_recipient.id, 'feedback_message_submitted',
      format(
        'اقتراح/شكوى جديد%s: %s',
        case when v_tutor_name is not null then ' من صفحة ' || v_tutor_name else ' من الصفحة الرئيسية' end,
        left(trim(p_message_text), 150)
      )
    );
  end loop;

  return v_id;
end;
$$;

grant execute on function submit_feedback_message(uuid, text, text, text) to anon, authenticated;
