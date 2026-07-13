-- ============================================================================
-- ⚠️  DANGER — FULL DATA RESET  ⚠️
--
-- This script PERMANENTLY DELETES every tutor, every student/booking/
-- payment record, every grade/group, every TA/tutor login account, and
-- every uploaded profile photo. It is NOT reversible.
--
-- What it PRESERVES:
--   - The database schema (tables, columns, functions, RLS policies,
--     triggers) — nothing here is dropped or altered.
--   - Exactly ONE auth account: the super admin matching the email set
--     in KEEP_SUPER_ADMIN_EMAIL below.
--
-- What it DELETES:
--   - Every other auth/admin_users account (every tutor and TA login).
--   - All bookings, monthly_payments, student_notes, notifications.
--   - All grades, groups, settings rows.
--   - All ta_tutor_links.
--   - All tutors.
--   - All objects in the tutor-photos storage bucket.
--
-- Run this ONLY via the Supabase SQL Editor, ONLY after explicit
-- confirmation from the project owner. Meant for pre-launch testing
-- resets and the final reset right before handover to a real customer —
-- never run this against a database with real paying customers on it.
-- ============================================================================

do $$
declare
  keep_email text := 'admin1123@gmail.com';
begin
  -- Deleting from auth.users cascades to admin_users (admin_users.id
  -- references auth.users.id on delete cascade), which in turn cascades
  -- to ta_tutor_links (ta_tutor_links.ta_id references admin_users.id on
  -- delete cascade). This removes every tutor/TA login in one step.
  delete from auth.users where email <> keep_email;
end $$;

-- Storage: every uploaded tutor profile photo.
delete from storage.objects where bucket_id = 'tutor-photos';

-- Tutor-scoped data, deleted in FK-safe order (children before parents).
-- monthly_payments/student_notes/notifications also cascade automatically
-- from the bookings delete below, but deleting them explicitly first
-- keeps this script correct even if that cascade behavior ever changes.
delete from notifications;
delete from student_notes;
delete from monthly_payments;
delete from bookings;
delete from ta_tutor_links;
delete from groups;
delete from grades;
delete from settings;

-- Tutors last: bookings.tutor_id is ON DELETE RESTRICT, so this would
-- fail loudly (not silently corrupt anything) if any booking survived
-- the deletes above — a safety net, not just cleanup order.
delete from tutors;

-- The surviving super admin's tutor_id auto-nulled via tutors' ON DELETE
-- SET NULL foreign key once its tutor row was deleted above; nothing
-- further to do for that account.
