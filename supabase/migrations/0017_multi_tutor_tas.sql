-- ============================================================================
-- Multi-tutor TAs: a TA (assistant) may now work with more than one tutor.
-- admin_users.tutor_id keeps its existing meaning of "the tutor this admin
-- is CURRENTLY acting as" (the same field super_admin's switchActiveTutor
-- already repurposes) — every existing RLS policy that scopes a 'ta' read
-- to admin_has_tutor_access(..., array['ta']) keeps working unchanged,
-- since it just compares against whichever tutor_id is currently set.
--
-- ta_tutor_links is the new source of truth for WHICH tutors a TA may
-- switch between. A TA can read their own links (to populate the
-- switcher); only a super_admin can create/remove links (per requirement:
-- "Super admin assigns/removes a TA's tutors from the TA management
-- page"). A tutor can read links for TAs assigned to them, so their own
-- "المساعدون" list stays accurate even while a shared TA is currently
-- switched to a different tutor.
-- ============================================================================

create table ta_tutor_links (
  ta_id uuid not null references admin_users (id) on delete cascade,
  tutor_id uuid not null references tutors (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ta_id, tutor_id)
);

create index idx_ta_tutor_links_ta_id on ta_tutor_links (ta_id);
create index idx_ta_tutor_links_tutor_id on ta_tutor_links (tutor_id);

alter table ta_tutor_links enable row level security;

create policy "super admin manages ta tutor links"
  on ta_tutor_links for all
  to authenticated
  using (admin_has_tutor_access(ta_tutor_links.tutor_id, array['super_admin']))
  with check (admin_has_tutor_access(ta_tutor_links.tutor_id, array['super_admin']));

create policy "tutor reads own ta tutor links"
  on ta_tutor_links for select
  to authenticated
  using (admin_has_tutor_access(ta_tutor_links.tutor_id, array['tutor']));

create policy "ta reads own tutor links"
  on ta_tutor_links for select
  to authenticated
  using (ta_tutor_links.ta_id = auth.uid());

-- Backfill: every existing TA (single tutor_id, pre-dating this migration)
-- gets a matching link row so nothing breaks for TAs created before this.
insert into ta_tutor_links (ta_id, tutor_id)
select id, tutor_id from admin_users where role = 'ta' and tutor_id is not null
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Lets a TA switch which of THEIR OWN linked tutors is currently active,
-- without granting them any broader update access to admin_users.
-- ----------------------------------------------------------------------------

create or replace function ta_can_switch_to_tutor(p_tutor_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from ta_tutor_links l
    where l.ta_id = auth.uid() and l.tutor_id = p_tutor_id
  );
$$;

grant execute on function ta_can_switch_to_tutor(uuid) to authenticated;

create policy "ta switches own active tutor"
  on admin_users for update
  to authenticated
  using (admin_users.id = auth.uid() and admin_users.role = 'ta')
  with check (
    admin_users.id = auth.uid()
    and admin_users.role = 'ta'
    and ta_can_switch_to_tutor(admin_users.tutor_id)
  );

-- A tutor's "المساعدون" list must keep showing a TA that's currently
-- switched to a DIFFERENT tutor (admin_users.tutor_id no longer matches
-- this tutor in that moment) — so this reads through the link table
-- instead of the existing tutor_id-based view policy.
create policy "tutor reads linked ta admin_users"
  on admin_users for select
  to authenticated
  using (
    admin_users.role = 'ta'
    and exists (
      select 1 from ta_tutor_links l
      where l.ta_id = admin_users.id
        and admin_has_tutor_access(l.tutor_id, array['tutor'])
    )
  );
