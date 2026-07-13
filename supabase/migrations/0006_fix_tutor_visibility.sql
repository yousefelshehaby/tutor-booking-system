-- ============================================================================
-- Fix: the public "grades"/"groups" SELECT policies check tutor activity via
-- `exists (select 1 from tutors ...)`. That subquery runs as the querying
-- role (anon) too, and anon has no RLS policy on `tutors` at all (by
-- design, to protect Paymob secrets) — so the subquery always sees zero
-- rows and the exists() check always fails, hiding every grade/group.
--
-- Fix: check tutor activity through a SECURITY DEFINER function that
-- returns only a boolean, bypassing tutors' RLS internally without ever
-- exposing a secret column to the caller.
-- ============================================================================

create or replace function is_tutor_active(p_tutor_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from tutors where tutors.id = p_tutor_id and tutors.is_active = true
  );
$$;

grant execute on function is_tutor_active(uuid) to anon, authenticated;

drop policy "public can read active grades of active tutors" on grades;

create policy "public can read active grades of active tutors"
  on grades for select
  to anon
  using (is_active = true and is_tutor_active(tutor_id));

drop policy "public can read active groups of active tutors" on groups;

create policy "public can read active groups of active tutors"
  on groups for select
  to anon
  using (is_active = true and is_tutor_active(tutor_id));
