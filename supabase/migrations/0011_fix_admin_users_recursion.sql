-- ============================================================================
-- Fix: every policy added in 0010 checks the caller's role via
-- `exists (select 1 from admin_users au where au.id = auth.uid() ...)`.
-- That subquery is itself subject to admin_users' own RLS policies —
-- including the ones just added, which query admin_users again to check
-- the caller — causing genuine infinite recursion (detected as error
-- 42P17), unlike the earlier tutors/is_tutor_active case where the
-- subquery targeted a *different* table. This currently breaks every
-- authenticated query in the entire admin panel.
--
-- Fix: route the check through a SECURITY DEFINER function. Running with
-- the function owner's privileges means its internal admin_users lookup
-- bypasses RLS entirely (table owners are exempt from RLS by default), so
-- no recursion — same pattern as is_tutor_active().
-- ============================================================================

create or replace function admin_has_tutor_access(p_tutor_id uuid, p_roles text[])
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from admin_users au
    where au.id = auth.uid()
      and au.is_active = true
      and au.role = any(p_roles)
      and (au.role = 'super_admin' or au.tutor_id = p_tutor_id)
  );
$$;

grant execute on function admin_has_tutor_access(uuid, text[]) to authenticated;

-- ----------------------------------------------------------------------------
-- admin_users
-- ----------------------------------------------------------------------------

drop policy "tutor and super admin view own tutor admin_users" on admin_users;

create policy "tutor and super admin view own tutor admin_users"
  on admin_users for select
  to authenticated
  using (admin_has_tutor_access(admin_users.tutor_id, array['tutor', 'super_admin']));

drop policy "tutor and super admin deactivate own tutor ta" on admin_users;

create policy "tutor and super admin deactivate own tutor ta"
  on admin_users for update
  to authenticated
  using (
    admin_users.role = 'ta'
    and admin_has_tutor_access(admin_users.tutor_id, array['tutor', 'super_admin'])
  )
  with check (admin_users.role = 'ta');

-- ----------------------------------------------------------------------------
-- tutors
-- ----------------------------------------------------------------------------

drop policy "tutor and super admin manage own tutor row" on tutors;

create policy "tutor and super admin manage own tutor row"
  on tutors for all
  to authenticated
  using (admin_has_tutor_access(tutors.id, array['tutor', 'super_admin']))
  with check (admin_has_tutor_access(tutors.id, array['tutor', 'super_admin']));

-- ----------------------------------------------------------------------------
-- grades
-- ----------------------------------------------------------------------------

drop policy "tutor and super admin manage own grades" on grades;
drop policy "ta can view own tutor grades" on grades;

create policy "tutor and super admin manage own grades"
  on grades for all
  to authenticated
  using (admin_has_tutor_access(grades.tutor_id, array['tutor', 'super_admin']))
  with check (admin_has_tutor_access(grades.tutor_id, array['tutor', 'super_admin']));

create policy "ta can view own tutor grades"
  on grades for select
  to authenticated
  using (admin_has_tutor_access(grades.tutor_id, array['ta']));

-- ----------------------------------------------------------------------------
-- groups
-- ----------------------------------------------------------------------------

drop policy "tutor and super admin manage own groups" on groups;
drop policy "ta can view own tutor groups" on groups;

create policy "tutor and super admin manage own groups"
  on groups for all
  to authenticated
  using (admin_has_tutor_access(groups.tutor_id, array['tutor', 'super_admin']))
  with check (admin_has_tutor_access(groups.tutor_id, array['tutor', 'super_admin']));

create policy "ta can view own tutor groups"
  on groups for select
  to authenticated
  using (admin_has_tutor_access(groups.tutor_id, array['ta']));

-- ----------------------------------------------------------------------------
-- bookings
-- ----------------------------------------------------------------------------

drop policy "tutor and super admin manage own bookings" on bookings;
drop policy "ta can view own tutor bookings" on bookings;

create policy "tutor and super admin manage own bookings"
  on bookings for all
  to authenticated
  using (admin_has_tutor_access(bookings.tutor_id, array['tutor', 'super_admin']))
  with check (admin_has_tutor_access(bookings.tutor_id, array['tutor', 'super_admin']));

create policy "ta can view own tutor bookings"
  on bookings for select
  to authenticated
  using (admin_has_tutor_access(bookings.tutor_id, array['ta']));

-- ----------------------------------------------------------------------------
-- settings
-- ----------------------------------------------------------------------------

drop policy "tutor and super admin manage own settings" on settings;

create policy "tutor and super admin manage own settings"
  on settings for all
  to authenticated
  using (admin_has_tutor_access(settings.tutor_id, array['tutor', 'super_admin']))
  with check (admin_has_tutor_access(settings.tutor_id, array['tutor', 'super_admin']));

-- ----------------------------------------------------------------------------
-- monthly_payments
-- ----------------------------------------------------------------------------

drop policy "tutor and super admin manage own monthly payments" on monthly_payments;
drop policy "ta can view own tutor monthly payments" on monthly_payments;

create policy "tutor and super admin manage own monthly payments"
  on monthly_payments for all
  to authenticated
  using (admin_has_tutor_access(monthly_payments.tutor_id, array['tutor', 'super_admin']))
  with check (admin_has_tutor_access(monthly_payments.tutor_id, array['tutor', 'super_admin']));

create policy "ta can view own tutor monthly payments"
  on monthly_payments for select
  to authenticated
  using (admin_has_tutor_access(monthly_payments.tutor_id, array['ta']));

-- ----------------------------------------------------------------------------
-- student_notes: any active admin of the tutor (tutor/ta/super_admin) can read
-- ----------------------------------------------------------------------------

drop policy "tutor ta super admin can read own tutor notes" on student_notes;

create policy "tutor ta super admin can read own tutor notes"
  on student_notes for select
  to authenticated
  using (admin_has_tutor_access(student_notes.tutor_id, array['tutor', 'ta', 'super_admin']));
