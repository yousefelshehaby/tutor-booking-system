-- ============================================================================
-- Tutor Booking & Payment System — Initial Schema
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type payment_method as enum ('card', 'wallet', 'fawry', 'reserve_only');

create type payment_status as enum ('pending', 'paid', 'expired', 'cancelled');

-- ----------------------------------------------------------------------------
-- grades
-- ----------------------------------------------------------------------------

create table grades (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_grades_display_order on grades (display_order);
create index idx_grades_is_active on grades (is_active);

-- ----------------------------------------------------------------------------
-- groups
-- ----------------------------------------------------------------------------

create table groups (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references grades (id) on delete cascade,
  name text not null,
  days text not null,
  time text not null,
  capacity int not null check (capacity > 0),
  price numeric(10, 2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_groups_grade_id on groups (grade_id);
create index idx_groups_is_active on groups (is_active);

-- ----------------------------------------------------------------------------
-- bookings
-- ----------------------------------------------------------------------------

create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  student_name text not null,
  student_phone text not null,
  guardian_phone text not null,
  grade_id uuid not null references grades (id) on delete restrict,
  group_id uuid not null references groups (id) on delete restrict,
  payment_method payment_method not null,
  payment_status payment_status not null default 'pending',
  paymob_order_id text,
  amount numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz
);

create index idx_bookings_group_id on bookings (group_id);
create index idx_bookings_grade_id on bookings (grade_id);
create index idx_bookings_payment_status on bookings (payment_status);
create index idx_bookings_booking_code on bookings (booking_code);
create index idx_bookings_student_phone on bookings (student_phone);
create index idx_bookings_expires_at on bookings (expires_at) where payment_method = 'reserve_only';

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table grades enable row level security;
alter table groups enable row level security;
alter table bookings enable row level security;

-- grades: public can read active grades only; admins (authenticated) can do everything
create policy "public can read active grades"
  on grades for select
  to anon
  using (is_active = true);

create policy "authenticated full access to grades"
  on grades for all
  to authenticated
  using (true)
  with check (true);

-- groups: public can read active groups only; admins can do everything
create policy "public can read active groups"
  on groups for select
  to anon
  using (is_active = true);

create policy "authenticated full access to groups"
  on groups for all
  to authenticated
  using (true)
  with check (true);

-- bookings: public can insert only; admins can do everything (including select)
create policy "public can insert bookings"
  on bookings for insert
  to anon
  with check (true);

create policy "authenticated full access to bookings"
  on bookings for all
  to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- Helper: lazily expire reserve_only bookings past their expiry
-- ----------------------------------------------------------------------------

create or replace function expire_stale_reservations()
returns void
language sql
as $$
  update bookings
  set payment_status = 'expired'
  where payment_method = 'reserve_only'
    and payment_status = 'pending'
    and expires_at is not null
    and expires_at < now();
$$;
