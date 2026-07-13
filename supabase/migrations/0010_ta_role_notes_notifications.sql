-- ============================================================================
-- TA role, student notes, notifications
--
-- Replaces the admin_users.is_super_admin boolean with a proper `role`
-- ('tutor' | 'ta' | 'super_admin'), adds `is_active` (deactivating a TA
-- revokes all access without deleting their Supabase Auth account) and
-- `email` (denormalized for display — auth.users isn't queryable via
-- PostgREST). Every existing RLS policy that checked is_super_admin is
-- rewritten to use role, and read/write are now split per table so a TA
-- gets SELECT-only access while tutor/super_admin keep full control.
-- ============================================================================

alter table admin_users add column role text;
alter table admin_users add column is_active boolean not null default true;
alter table admin_users add column email text;

update admin_users set role = case when is_super_admin then 'super_admin' else 'tutor' end;

alter table admin_users alter column role set not null;
alter table admin_users add constraint admin_users_role_check check (role in ('tutor', 'ta', 'super_admin'));

-- ----------------------------------------------------------------------------
-- Drop every existing policy that still references is_super_admin, BEFORE
-- dropping the column itself.
-- ----------------------------------------------------------------------------

drop policy "super admin can switch their own active tutor" on admin_users;
drop policy "tutor admin can manage own tutor row" on tutors;
drop policy "tutor admin manages own grades" on grades;
drop policy "tutor admin manages own groups" on groups;
drop policy "tutor admin manages own bookings" on bookings;
drop policy "tutor admin manages own settings" on settings;
drop policy "tutor admin manages own monthly payments" on monthly_payments;

alter table admin_users drop column is_super_admin;

-- ----------------------------------------------------------------------------
-- admin_users policies
-- ----------------------------------------------------------------------------

create policy "super admin can switch their own active tutor"
  on admin_users for update
  to authenticated
  using (id = auth.uid() and role = 'super_admin')
  with check (id = auth.uid());

create policy "tutor and super admin view own tutor admin_users"
  on admin_users for select
  to authenticated
  using (
    exists (
      select 1 from admin_users au2
      where au2.id = auth.uid() and au2.is_active = true
        and (au2.role = 'super_admin' or (au2.role = 'tutor' and au2.tutor_id = admin_users.tutor_id))
    )
  );

create policy "tutor and super admin deactivate own tutor ta"
  on admin_users for update
  to authenticated
  using (
    admin_users.role = 'ta'
    and exists (
      select 1 from admin_users au2
      where au2.id = auth.uid() and au2.is_active = true
        and (au2.role = 'super_admin' or (au2.role = 'tutor' and au2.tutor_id = admin_users.tutor_id))
    )
  )
  with check (admin_users.role = 'ta');

-- ----------------------------------------------------------------------------
-- tutors: unchanged shape, just role-based now
-- ----------------------------------------------------------------------------

create policy "tutor and super admin manage own tutor row"
  on tutors for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = tutors.id))
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = tutors.id))
    )
  );

-- ----------------------------------------------------------------------------
-- grades: tutor/super_admin full access, ta read-only
-- ----------------------------------------------------------------------------

create policy "tutor and super admin manage own grades"
  on grades for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = grades.tutor_id))
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = grades.tutor_id))
    )
  );

create policy "ta can view own tutor grades"
  on grades for select
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and au.role = 'ta' and au.tutor_id = grades.tutor_id
    )
  );

-- ----------------------------------------------------------------------------
-- groups: same pattern
-- ----------------------------------------------------------------------------

create policy "tutor and super admin manage own groups"
  on groups for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = groups.tutor_id))
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = groups.tutor_id))
    )
  );

create policy "ta can view own tutor groups"
  on groups for select
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and au.role = 'ta' and au.tutor_id = groups.tutor_id
    )
  );

-- ----------------------------------------------------------------------------
-- bookings: same pattern — this is the TA's "read-only access to students"
-- ----------------------------------------------------------------------------

create policy "tutor and super admin manage own bookings"
  on bookings for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = bookings.tutor_id))
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = bookings.tutor_id))
    )
  );

create policy "ta can view own tutor bookings"
  on bookings for select
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and au.role = 'ta' and au.tutor_id = bookings.tutor_id
    )
  );

-- ----------------------------------------------------------------------------
-- settings: no TA access at all
-- ----------------------------------------------------------------------------

create policy "tutor and super admin manage own settings"
  on settings for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = settings.tutor_id))
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = settings.tutor_id))
    )
  );

-- ----------------------------------------------------------------------------
-- monthly_payments: tutor/super_admin full access, ta read-only
-- ----------------------------------------------------------------------------

create policy "tutor and super admin manage own monthly payments"
  on monthly_payments for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = monthly_payments.tutor_id))
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or (au.role = 'tutor' and au.tutor_id = monthly_payments.tutor_id))
    )
  );

create policy "ta can view own tutor monthly payments"
  on monthly_payments for select
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and au.role = 'ta' and au.tutor_id = monthly_payments.tutor_id
    )
  );

-- ----------------------------------------------------------------------------
-- student_notes
-- ----------------------------------------------------------------------------

create table student_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  tutor_id uuid not null references tutors (id) on delete cascade,
  created_by uuid not null references admin_users (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index idx_student_notes_booking_id on student_notes (booking_id);
create index idx_student_notes_tutor_id on student_notes (tutor_id);

alter table student_notes enable row level security;

create policy "tutor ta super admin can read own tutor notes"
  on student_notes for select
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid() and au.is_active = true
        and (au.role = 'super_admin' or au.tutor_id = student_notes.tutor_id)
    )
  );

-- No insert/update/delete policy: all writes go through create_student_note()
-- below, which validates authorization and fans out notifications atomically.

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  recipient_admin_id uuid not null references admin_users (id) on delete cascade,
  student_note_id uuid references student_notes (id) on delete cascade,
  booking_id uuid references bookings (id) on delete cascade,
  student_name text not null,
  booking_code text not null,
  grade_name text not null,
  group_name text not null,
  note_excerpt text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_recipient on notifications (recipient_admin_id);

alter table notifications enable row level security;

create policy "recipient can read own notifications"
  on notifications for select
  to authenticated
  using (recipient_admin_id = auth.uid());

create policy "recipient can mark own notifications read"
  on notifications for update
  to authenticated
  using (recipient_admin_id = auth.uid())
  with check (recipient_admin_id = auth.uid());

-- ----------------------------------------------------------------------------
-- create_student_note: validates the caller belongs to the tutor (or is a
-- super admin), inserts the note, then fans out one notification row per
-- recipient (the tutor + every active super admin).
-- ----------------------------------------------------------------------------

create or replace function create_student_note(
  p_tutor_id uuid,
  p_booking_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text;
  v_caller_tutor_id uuid;
  v_caller_active boolean;
  v_note_id uuid;
  v_booking bookings%rowtype;
  v_grade_name text;
  v_group_name text;
  v_recipient record;
begin
  select role, tutor_id, is_active into v_caller_role, v_caller_tutor_id, v_caller_active
  from admin_users where admin_users.id = auth.uid();

  if not found or v_caller_active = false then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  if v_caller_role <> 'super_admin' and v_caller_tutor_id <> p_tutor_id then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  select * into v_booking from bookings where bookings.id = p_booking_id and bookings.tutor_id = p_tutor_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  select grades.name into v_grade_name from grades where grades.id = v_booking.grade_id;
  select groups.name into v_group_name from groups where groups.id = v_booking.group_id;

  insert into student_notes (booking_id, tutor_id, created_by, note)
  values (p_booking_id, p_tutor_id, auth.uid(), p_note)
  returning student_notes.id into v_note_id;

  for v_recipient in
    select admin_users.id from admin_users
    where admin_users.is_active = true
      and (
        (admin_users.tutor_id = p_tutor_id and admin_users.role = 'tutor')
        or admin_users.role = 'super_admin'
      )
  loop
    insert into notifications (
      tutor_id, recipient_admin_id, student_note_id, booking_id,
      student_name, booking_code, grade_name, group_name, note_excerpt
    ) values (
      p_tutor_id, v_recipient.id, v_note_id, p_booking_id,
      v_booking.student_name, v_booking.booking_code, v_grade_name, v_group_name,
      left(p_note, 200)
    );
  end loop;

  return v_note_id;
end;
$$;

grant execute on function create_student_note(uuid, uuid, text) to authenticated;
