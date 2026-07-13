-- ============================================================================
-- SECURITY FIX found via live testing of 0017: when a table has multiple
-- PERMISSIVE policies for the same command, Postgres ORs their USING
-- clauses together to decide which rows are visible, but it ALSO ORs
-- their WITH CHECK clauses together for validating the new row —
-- independently of which policy's USING clause is what made the row
-- visible in the first place. Two pre-existing admin_users UPDATE
-- policies had WITH CHECK clauses far weaker than their USING clauses
-- (assuming, wrongly, that only their own USING-matching caller could
-- ever reach them):
--
--   "super admin can switch their own active tutor": with check was just
--   `id = auth.uid()` — no role/tutor_id restriction at all.
--
--   "tutor and super admin deactivate own tutor ta": with check was just
--   `role = 'ta'` — no tutor_id restriction.
--
-- Once 0017 added a THIRD update policy whose USING clause makes a 'ta'
-- row visible for update (id = auth.uid() and role = 'ta'), those two
-- weak WITH CHECK clauses became a live escape hatch: a TA's PATCH to
-- their own admin_users row got its row-visibility from the new TA
-- policy, then had its NEW row validated against the OR of all three
-- policies' checks — and the weak ones trivially passed regardless of
-- ta_can_switch_to_tutor(), letting a TA switch to ANY tutor_id at all
-- (confirmed via a live test: switching to an unlinked tutor succeeded).
--
-- Fix: tighten both WITH CHECK clauses to mirror their own USING clause,
-- so they can never pass for a caller/row combination their USING clause
-- wouldn't have allowed in the first place.
-- ============================================================================

drop policy "super admin can switch their own active tutor" on admin_users;
create policy "super admin can switch their own active tutor"
  on admin_users for update
  to authenticated
  using (admin_users.id = auth.uid() and admin_users.role = 'super_admin')
  with check (admin_users.id = auth.uid() and admin_users.role = 'super_admin');

drop policy "tutor and super admin deactivate own tutor ta" on admin_users;
create policy "tutor and super admin deactivate own tutor ta"
  on admin_users for update
  to authenticated
  using (
    admin_users.role = 'ta'
    and admin_has_tutor_access(admin_users.tutor_id, array['tutor', 'super_admin'])
  )
  with check (
    admin_users.role = 'ta'
    and admin_has_tutor_access(admin_users.tutor_id, array['tutor', 'super_admin'])
  );
