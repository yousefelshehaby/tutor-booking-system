-- ============================================================================
-- Multi-tenant foundation
--
-- Introduces `tutors` as the top-level tenant. Every grade/group/booking now
-- belongs to exactly one tutor. Public reads are scoped to active tutors;
-- admin reads/writes are scoped to the admin's own tutor (via `admin_users`),
-- except super admins who see everything.
--
-- Paymob credentials live on `tutors` (never exposed to anon — no public
-- policy grants SELECT on this table at all; public tutor lookup goes
-- through the get_tutor_by_slug() SECURITY DEFINER function, which returns
-- only safe columns).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- tutors
-- ----------------------------------------------------------------------------

create table tutors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  phone text,
  is_active boolean not null default true,
  paymob_api_key text,
  paymob_hmac_secret text,
  paymob_card_integration_id text,
  paymob_wallet_integration_id text,
  paymob_fawry_integration_id text,
  paymob_iframe_id text,
  created_at timestamptz not null default now()
);

create index idx_tutors_slug on tutors (slug);
create index idx_tutors_is_active on tutors (is_active);

alter table tutors enable row level security;
-- Intentionally no anon policy: tutors holds Paymob secrets. Public lookup
-- goes through get_tutor_by_slug() below.

-- ----------------------------------------------------------------------------
-- admin_users: links a Supabase Auth user to a tutor (or marks super admin)
-- ----------------------------------------------------------------------------

create table admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  tutor_id uuid references tutors (id) on delete set null,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_admin_users_tutor_id on admin_users (tutor_id);

alter table admin_users enable row level security;

create policy "admin can read own admin_users row"
  on admin_users for select
  to authenticated
  using (id = auth.uid());

create policy "tutor admin can manage own tutor row"
  on tutors for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = tutors.id)
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = tutors.id)
    )
  );

-- ----------------------------------------------------------------------------
-- Seed a bootstrap tutor and backfill existing data onto it
-- ----------------------------------------------------------------------------

insert into tutors (name, slug, is_active)
values ('المدرّس الافتراضي', 'default', true)
on conflict (slug) do nothing;

alter table grades add column tutor_id uuid references tutors (id) on delete cascade;
update grades set tutor_id = (select id from tutors where slug = 'default') where tutor_id is null;
alter table grades alter column tutor_id set not null;
create index idx_grades_tutor_id on grades (tutor_id);

alter table groups add column tutor_id uuid references tutors (id) on delete cascade;
alter table groups add column monthly_fee numeric(10, 2);
update groups set tutor_id = (select id from tutors where slug = 'default') where tutor_id is null;
alter table groups alter column tutor_id set not null;
create index idx_groups_tutor_id on groups (tutor_id);

alter table bookings add column tutor_id uuid references tutors (id) on delete restrict;
update bookings set tutor_id = (select id from tutors where slug = 'default') where tutor_id is null;
alter table bookings alter column tutor_id set not null;
create index idx_bookings_tutor_id on bookings (tutor_id);

-- ----------------------------------------------------------------------------
-- Rewrite RLS: grades
-- ----------------------------------------------------------------------------

drop policy "public can read active grades" on grades;
drop policy "authenticated full access to grades" on grades;

create policy "public can read active grades of active tutors"
  on grades for select
  to anon
  using (
    is_active = true
    and exists (select 1 from tutors t where t.id = grades.tutor_id and t.is_active = true)
  );

create policy "tutor admin manages own grades"
  on grades for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = grades.tutor_id)
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = grades.tutor_id)
    )
  );

-- ----------------------------------------------------------------------------
-- Rewrite RLS: groups
-- ----------------------------------------------------------------------------

drop policy "public can read active groups" on groups;
drop policy "authenticated full access to groups" on groups;

create policy "public can read active groups of active tutors"
  on groups for select
  to anon
  using (
    is_active = true
    and exists (select 1 from tutors t where t.id = groups.tutor_id and t.is_active = true)
  );

create policy "tutor admin manages own groups"
  on groups for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = groups.tutor_id)
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = groups.tutor_id)
    )
  );

-- ----------------------------------------------------------------------------
-- Rewrite RLS: bookings
--
-- Direct anon INSERT is removed — all public writes now go exclusively
-- through the create_booking() SECURITY DEFINER function below, which
-- validates tutor/grade/group consistency and capacity atomically. This is
-- strictly tighter than before (the old direct-insert policy let anon set
-- any tutor_id/amount/price directly, which is unsafe once multiple tenants
-- exist).
-- ----------------------------------------------------------------------------

drop policy "public can insert bookings" on bookings;
drop policy "authenticated full access to bookings" on bookings;

create policy "tutor admin manages own bookings"
  on bookings for all
  to authenticated
  using (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = bookings.tutor_id)
    )
  )
  with check (
    exists (
      select 1 from admin_users au
      where au.id = auth.uid()
        and (au.is_super_admin = true or au.tutor_id = bookings.tutor_id)
    )
  );

-- ----------------------------------------------------------------------------
-- get_tutor_by_slug: the only public read path into `tutors`. Returns only
-- non-secret columns, and only for active tutors (inactive/unknown slug ->
-- empty result -> app renders a 404).
-- ----------------------------------------------------------------------------

create or replace function get_tutor_by_slug(p_slug text)
returns table (id uuid, name text, slug text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select tutors.id, tutors.name, tutors.slug
  from tutors
  where tutors.slug = p_slug
    and tutors.is_active = true;
$$;

grant execute on function get_tutor_by_slug(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- get_groups_with_availability: now scoped to a specific tutor
-- ----------------------------------------------------------------------------

drop function if exists get_groups_with_availability(uuid);

create or replace function get_groups_with_availability(p_tutor_id uuid, p_grade_id uuid)
returns table (
  id uuid,
  name text,
  days text,
  "time" text,
  price numeric,
  capacity int,
  remaining_seats int
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    g.id,
    g.name,
    g.days,
    g.time,
    g.price,
    g.capacity,
    greatest(g.capacity - coalesce(b.active_count, 0), 0)::int as remaining_seats
  from groups g
  left join (
    select
      group_id,
      count(*) as active_count
    from bookings
    where payment_status = 'paid'
       or (payment_status = 'pending' and (payment_method <> 'reserve_only' or expires_at > now()))
    group by group_id
  ) b on b.group_id = g.id
  where g.grade_id = p_grade_id
    and g.tutor_id = p_tutor_id
    and g.is_active = true
  order by g.created_at;
$$;

grant execute on function get_groups_with_availability(uuid, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- create_booking: now takes p_tutor_id and cross-checks the group/grade
-- actually belong to that tutor (defense in depth beyond the FK relations),
-- and returns tutor_id so the caller can look up that tutor's Paymob
-- credentials for the next step without a second round trip.
-- ----------------------------------------------------------------------------

drop function if exists create_booking(text, text, text, uuid, uuid, payment_method);

create or replace function create_booking(
  p_tutor_id uuid,
  p_student_name text,
  p_student_phone text,
  p_guardian_phone text,
  p_grade_id uuid,
  p_group_id uuid,
  p_payment_method payment_method
)
returns table (
  id uuid,
  booking_code text,
  amount numeric,
  expires_at timestamptz,
  tutor_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group groups%rowtype;
  v_grade_active boolean;
  v_grade_tutor uuid;
  v_tutor_active boolean;
  v_active_count int;
  v_booking_code text;
  v_expires_at timestamptz;
  v_new_id uuid;
begin
  perform expire_stale_reservations();

  select tutors.is_active into v_tutor_active from tutors where tutors.id = p_tutor_id;
  if not found or v_tutor_active = false then
    raise exception 'TUTOR_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_group from groups where groups.id = p_group_id for update;
  if not found or v_group.is_active = false then
    raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_group.tutor_id <> p_tutor_id then
    raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_group.grade_id <> p_grade_id then
    raise exception 'GROUP_GRADE_MISMATCH' using errcode = 'P0001';
  end if;

  select grades.is_active, grades.tutor_id into v_grade_active, v_grade_tutor
  from grades where grades.id = p_grade_id;
  if not found or v_grade_active = false or v_grade_tutor <> p_tutor_id then
    raise exception 'GRADE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select count(*) into v_active_count
  from bookings
  where bookings.group_id = p_group_id
    and (
      bookings.payment_status = 'paid'
      or (
        bookings.payment_status = 'pending'
        and (bookings.payment_method <> 'reserve_only' or bookings.expires_at > now())
      )
    );

  if v_active_count >= v_group.capacity then
    raise exception 'GROUP_FULL' using errcode = 'P0001';
  end if;

  v_booking_code := generate_booking_code();

  if p_payment_method = 'reserve_only' then
    v_expires_at := now() + interval '48 hours';
  else
    v_expires_at := null;
  end if;

  insert into bookings (
    booking_code, student_name, student_phone, guardian_phone,
    grade_id, group_id, tutor_id, payment_method, payment_status, amount, expires_at
  ) values (
    v_booking_code, p_student_name, p_student_phone, p_guardian_phone,
    p_grade_id, p_group_id, p_tutor_id, p_payment_method, 'pending', v_group.price, v_expires_at
  )
  returning bookings.id into v_new_id;

  return query
    select v_new_id, v_booking_code, v_group.price, v_expires_at, p_tutor_id;
end;
$$;

grant execute on function create_booking(uuid, text, text, text, uuid, uuid, payment_method) to anon, authenticated;
