-- ============================================================================
-- TA request workflow: tutors cannot create TA accounts themselves (by
-- design — only super_admin can, since that's what actually creates the
-- Supabase Auth user). This gives them a formal request queue instead.
--
-- All WRITES to ta_requests go through server actions using the
-- service-role client after an explicit role check in TypeScript
-- (matching every other tutors/TAs mutation in this codebase — see
-- createTutor, createTa, toggleTutorActive), not RLS-enforced RPCs. RLS
-- here only needs to cover SELECT, read directly by server components:
-- a tutor reads their own requests, a super admin reads all of them.
-- ============================================================================

create type ta_request_status as enum ('pending', 'approved', 'rejected');

create table ta_requests (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  ta_name text not null,
  ta_email text not null,
  ta_phone text,
  tutor_note text,
  status ta_request_status not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_ta_requests_tutor_id on ta_requests (tutor_id);
create index idx_ta_requests_status on ta_requests (status);

alter table ta_requests enable row level security;

create policy "tutor and super admin read own ta requests"
  on ta_requests for select
  to authenticated
  using (admin_has_tutor_access(ta_requests.tutor_id, array['tutor', 'super_admin']));

-- ----------------------------------------------------------------------------
-- Generalize notifications beyond "a student note was added": the
-- booking-specific columns become optional, and a `type` discriminator
-- plus a generic `message` column cover the new TA-request notifications
-- (submitted -> notifies every active super admin; resolved -> notifies
-- the requesting tutor).
-- ----------------------------------------------------------------------------

alter table notifications add column type text not null default 'student_note';
alter table notifications add constraint notifications_type_check
  check (type in ('student_note', 'ta_request_submitted', 'ta_request_resolved'));

alter table notifications alter column student_name drop not null;
alter table notifications alter column booking_code drop not null;
alter table notifications alter column grade_name drop not null;
alter table notifications alter column group_name drop not null;

alter table notifications add column ta_request_id uuid references ta_requests (id) on delete cascade;
alter table notifications add column message text;
