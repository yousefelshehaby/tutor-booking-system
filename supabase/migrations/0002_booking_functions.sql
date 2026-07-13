-- ============================================================================
-- Booking RPC functions
--
-- The `bookings` table only grants INSERT to anon (see 0001_init.sql RLS
-- policies) — students can never SELECT/UPDATE rows directly. All public
-- reads/writes needed by the student booking flow go through these
-- SECURITY DEFINER functions instead, which run with the owning role's
-- privileges (bypassing RLS) while enforcing business rules explicitly.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Human-readable booking codes: BK-<year>-<4-digit sequence>
-- ----------------------------------------------------------------------------

create sequence if not exists booking_code_seq;

create or replace function generate_booking_code()
returns text
language sql
set search_path = public, pg_temp
as $$
  select 'BK-' || extract(year from now())::int || '-' || lpad(nextval('booking_code_seq')::text, 4, '0');
$$;

-- ----------------------------------------------------------------------------
-- get_groups_with_availability: public read of active groups for a grade,
-- with remaining seats computed server-side (never exposes raw booking rows)
-- ----------------------------------------------------------------------------

create or replace function get_groups_with_availability(p_grade_id uuid)
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
    and g.is_active = true
  order by g.created_at;
$$;

grant execute on function get_groups_with_availability(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- create_booking: validates grade/group/capacity and inserts the booking
-- atomically. Locks the group row so two concurrent requests for the last
-- seat can never both succeed.
-- ----------------------------------------------------------------------------

create or replace function create_booking(
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
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group groups%rowtype;
  v_grade_active boolean;
  v_active_count int;
  v_booking_code text;
  v_expires_at timestamptz;
  v_new_id uuid;
begin
  select * into v_group from groups where id = p_group_id for update;
  if not found or v_group.is_active = false then
    raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_group.grade_id <> p_grade_id then
    raise exception 'GROUP_GRADE_MISMATCH' using errcode = 'P0001';
  end if;

  select is_active into v_grade_active from grades where id = p_grade_id;
  if not found or v_grade_active = false then
    raise exception 'GRADE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select count(*) into v_active_count
  from bookings
  where group_id = p_group_id
    and (
      payment_status = 'paid'
      or (payment_status = 'pending' and (payment_method <> 'reserve_only' or expires_at > now()))
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
    grade_id, group_id, payment_method, payment_status, amount, expires_at
  ) values (
    v_booking_code, p_student_name, p_student_phone, p_guardian_phone,
    p_grade_id, p_group_id, p_payment_method, 'pending', v_group.price, v_expires_at
  )
  returning bookings.id into v_new_id;

  return query
    select v_new_id, v_booking_code, v_group.price, v_expires_at;
end;
$$;

grant execute on function create_booking(text, text, text, uuid, uuid, payment_method) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- get_booking_by_code: used by the public success page. Deliberately omits
-- phone numbers and internal ids from the result.
-- ----------------------------------------------------------------------------

create or replace function get_booking_by_code(p_code text)
returns table (
  booking_code text,
  student_name text,
  payment_method payment_method,
  payment_status payment_status,
  amount numeric,
  expires_at timestamptz,
  created_at timestamptz,
  grade_name text,
  group_name text,
  group_days text,
  group_time text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    b.booking_code,
    b.student_name,
    b.payment_method,
    b.payment_status,
    b.amount,
    b.expires_at,
    b.created_at,
    gr.name as grade_name,
    gp.name as group_name,
    gp.days as group_days,
    gp.time as group_time
  from bookings b
  join grades gr on gr.id = b.grade_id
  join groups gp on gp.id = b.group_id
  where b.booking_code = p_code;
$$;

grant execute on function get_booking_by_code(text) to anon, authenticated;
