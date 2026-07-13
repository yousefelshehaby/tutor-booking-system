-- ============================================================================
-- SECURITY FIX #2, found via re-testing 0018: a 'ta' row could ALSO
-- escalate straight to role = 'super_admin' via the same PATCH endpoint.
-- Cause: "super admin can switch their own active tutor"'s WITH CHECK
-- was tightened to require the NEW row's role = 'super_admin' — but the
-- attacker controls the NEW row entirely (that's the payload!), so
-- setting role: "super_admin" in the request body satisfies that check
-- trivially. Composing multiple PERMISSIVE policies' WITH CHECK clauses
-- (which Postgres ORs together table-wide, independent of which
-- policy's USING clause made the row visible) turned out to be too easy
-- to get subtly wrong twice in a row.
--
-- Fix: stop relying on RLS policy composition for these two invariants
-- and enforce them as hard BEFORE UPDATE triggers instead, which compare
-- against the REAL persisted OLD row (immune to anything in the
-- attacker's payload) regardless of which RLS policy let the statement
-- through:
--   1. admin_users.role can never change via UPDATE (it's only ever set
--      at INSERT — no app code anywhere changes it afterward).
--   2. If a 'ta' row's tutor_id is changing, the new value must already
--      be one of that TA's own ta_tutor_links rows.
-- Both are skipped for the service_role (server actions using
-- createServiceClient() legitimately change tutor_id/role, e.g. tutor
-- creation, and already bypass RLS entirely).
-- ============================================================================

create or replace function prevent_admin_users_role_change()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'ROLE_IMMUTABLE: admin_users.role cannot be changed via update' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists admin_users_role_immutable on admin_users;
create trigger admin_users_role_immutable
  before update on admin_users
  for each row
  execute function prevent_admin_users_role_change();

create or replace function validate_admin_users_tutor_id_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.tutor_id is distinct from old.tutor_id and old.role = 'ta' then
    if not exists (
      select 1 from ta_tutor_links
      where ta_tutor_links.ta_id = old.id and ta_tutor_links.tutor_id = new.tutor_id
    ) then
      raise exception 'TA_TUTOR_LINK_REQUIRED: tutor_id must be one of this TA''s linked tutors'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists admin_users_tutor_id_change_guard on admin_users;
create trigger admin_users_tutor_id_change_guard
  before update on admin_users
  for each row
  execute function validate_admin_users_tutor_id_change();
