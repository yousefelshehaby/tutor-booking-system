-- ============================================================================
-- Super admin support
--
-- A super admin already bypasses every RLS policy in the app (each policy's
-- USING/WITH CHECK includes `au.is_super_admin = true or ...`). What's
-- missing is a way for them to point their own admin session at a
-- different tutor so the existing admin UI (which always operates on "the
-- logged-in admin's tutor_id") works for whichever tutor they're currently
-- managing — no separate super-admin UI needed for grades/groups/bookings.
-- ============================================================================

create policy "super admin can switch their own active tutor"
  on admin_users for update
  to authenticated
  using (id = auth.uid() and is_super_admin = true)
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- list_active_tutors: powers the public homepage directory. Only exposes
-- name/slug — never the Paymob credential columns.
-- ----------------------------------------------------------------------------

create or replace function list_active_tutors()
returns table (id uuid, name text, slug text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select id, name, slug from tutors where is_active = true order by name;
$$;

grant execute on function list_active_tutors() to anon, authenticated;
