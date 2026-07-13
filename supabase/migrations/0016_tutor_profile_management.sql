-- ============================================================================
-- Super-admin tutor profile management: photo, bank details (informational,
-- never public), and lets get_tutor_by_slug / list_active_tutors surface the
-- photo on public pages.
-- ============================================================================

alter table tutors add column photo_url text;
alter table tutors add column bank_name text;
alter table tutors add column bank_account_holder text;
alter table tutors add column bank_account_number text;

-- Public storage bucket for tutor profile photos. All writes go through
-- server actions using the service-role client (bypasses storage RLS), and
-- reads are served directly from the public bucket URL — no RLS policies
-- needed on storage.objects for this bucket.
insert into storage.buckets (id, name, public)
values ('tutor-photos', 'tutor-photos', true)
on conflict (id) do nothing;

drop function if exists get_tutor_by_slug(text);
create or replace function get_tutor_by_slug(p_slug text)
returns table (id uuid, name text, slug text, photo_url text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select tutors.id, tutors.name, tutors.slug, tutors.photo_url
  from tutors
  where tutors.slug = p_slug
    and tutors.is_active = true;
$$;

grant execute on function get_tutor_by_slug(text) to anon, authenticated;

drop function if exists list_active_tutors();
create or replace function list_active_tutors()
returns table (id uuid, name text, slug text, photo_url text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select id, name, slug, photo_url from tutors where is_active = true order by name;
$$;

grant execute on function list_active_tutors() to anon, authenticated;
