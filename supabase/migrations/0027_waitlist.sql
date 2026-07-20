-- ============================================================================
-- Waitlist for full groups. A student who hits a full group can join a
-- per-group waitlist instead of just seeing a disabled "مكتملة" button.
-- All writes go through SECURITY DEFINER RPCs (join_waitlist is anon-
-- facing, same as create_booking; promote/cancel are authenticated-only
-- staff actions) — mirrors the create_booking / create_student_note
-- patterns already used throughout this schema.
-- ============================================================================

create type waitlist_status as enum ('waiting', 'converted', 'cancelled');

create table waitlist_requests (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  grade_id uuid not null references grades (id) on delete cascade,
  group_id uuid not null references groups (id) on delete cascade,
  student_name text not null,
  student_phone text not null,
  guardian_phone text not null,
  status waitlist_status not null default 'waiting',
  converted_booking_id uuid references bookings (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_waitlist_requests_group_status on waitlist_requests (group_id, status, created_at);
create index idx_waitlist_requests_tutor on waitlist_requests (tutor_id);
create index idx_waitlist_requests_phone on waitlist_requests (student_phone);

-- Only one active ("waiting") entry per phone per group — cancelled/
-- converted entries don't block rejoining.
create unique index uq_waitlist_requests_group_phone_waiting
  on waitlist_requests (group_id, student_phone)
  where status = 'waiting';

alter table waitlist_requests enable row level security;

create policy "tutor and super admin manage own waitlist requests"
  on waitlist_requests for all
  to authenticated
  using (admin_has_tutor_access(waitlist_requests.tutor_id, array['tutor', 'super_admin']))
  with check (admin_has_tutor_access(waitlist_requests.tutor_id, array['tutor', 'super_admin']));

create policy "ta can read own tutor waitlist requests"
  on waitlist_requests for select
  to authenticated
  using (admin_has_tutor_access(waitlist_requests.tutor_id, array['ta']));

-- ----------------------------------------------------------------------------
-- Widen the notifications.type check to cover the two new waitlist event
-- types. Both rely purely on the generic `message` column (already
-- nullable-friendly since 0021), same idiom as the ta_request_* types —
-- no bell UI change needed since it already falls back to {message} for
-- any type other than 'student_note'.
-- ----------------------------------------------------------------------------

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'student_note',
    'ta_request_submitted',
    'ta_request_resolved',
    'waitlist_request_submitted',
    'waitlist_seat_available'
  ));

-- ----------------------------------------------------------------------------
-- join_waitlist: public/anon-facing, mirrors create_booking's validation
-- shape. Idempotent on (group_id, student_phone) while waiting — a repeat
-- submission from the same phone returns their existing position instead
-- of erroring or duplicating.
-- ----------------------------------------------------------------------------

create or replace function join_waitlist(
  p_tutor_id uuid,
  p_grade_id uuid,
  p_group_id uuid,
  p_student_name text,
  p_student_phone text,
  p_guardian_phone text
)
returns table (
  id uuid,
  "position" int,
  already_existing boolean
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
  v_existing_id uuid;
  v_new_id uuid;
  v_recipient record;
  v_group_name text;
begin
  select tutors.is_active into v_tutor_active from tutors where tutors.id = p_tutor_id;
  if not found or v_tutor_active = false then
    raise exception 'TUTOR_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_group from groups where groups.id = p_group_id for update;
  if not found or v_group.is_active = false or v_group.tutor_id <> p_tutor_id then
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

  -- Already on this group's waiting list? Return their existing position
  -- instead of a duplicate row.
  select w.id into v_existing_id
  from waitlist_requests w
  where w.group_id = p_group_id and w.student_phone = p_student_phone and w.status = 'waiting';

  if found then
    return query
      select
        v_existing_id,
        (
          select count(*)::int from waitlist_requests w2
          where w2.group_id = p_group_id and w2.status = 'waiting'
            and w2.created_at <= (select w3.created_at from waitlist_requests w3 where w3.id = v_existing_id)
        ),
        true;
    return;
  end if;

  select count(*) into v_active_count
  from bookings
  where bookings.group_id = p_group_id
    and bookings.archived_at is null
    and (
      bookings.payment_status = 'paid'
      or (
        bookings.payment_status = 'pending'
        and (bookings.payment_method <> 'reserve_only' or bookings.expires_at > now())
      )
    );

  if v_active_count < v_group.capacity then
    raise exception 'GROUP_NOT_FULL' using errcode = 'P0001';
  end if;

  insert into waitlist_requests (tutor_id, grade_id, group_id, student_name, student_phone, guardian_phone)
  values (p_tutor_id, p_grade_id, p_group_id, p_student_name, p_student_phone, p_guardian_phone)
  returning waitlist_requests.id into v_new_id;

  select groups.name into v_group_name from groups where groups.id = p_group_id;

  for v_recipient in
    select admin_users.id from admin_users
    where admin_users.is_active = true
      and (
        (admin_users.tutor_id = p_tutor_id and admin_users.role = 'tutor')
        or admin_users.role = 'super_admin'
      )
  loop
    insert into notifications (tutor_id, recipient_admin_id, type, message)
    values (
      p_tutor_id, v_recipient.id, 'waitlist_request_submitted',
      format('طلب انضمام لقائمة الانتظار: %s (%s) — مجموعة %s', p_student_name, p_student_phone, v_group_name)
    );
  end loop;

  return query
    select
      v_new_id,
      (select count(*)::int from waitlist_requests w where w.group_id = p_group_id and w.status = 'waiting'),
      false;
end;
$$;

grant execute on function join_waitlist(uuid, uuid, uuid, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- find_waitlist_entry: public/anon-facing lookup for the phone-first entry
-- flow — most recent 'waiting' entry for this phone under this tutor.
-- ----------------------------------------------------------------------------

create or replace function find_waitlist_entry(p_tutor_id uuid, p_phone text)
returns table (
  id uuid,
  grade_name text,
  group_name text,
  "position" int,
  created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    w.id,
    gr.name,
    gp.name,
    (
      select count(*)::int from waitlist_requests w2
      where w2.group_id = w.group_id and w2.status = 'waiting' and w2.created_at <= w.created_at
    ),
    w.created_at
  from waitlist_requests w
  join grades gr on gr.id = w.grade_id
  join groups gp on gp.id = w.group_id
  where w.tutor_id = p_tutor_id
    and w.student_phone = p_phone
    and w.status = 'waiting'
  order by w.created_at desc
  limit 1;
$$;

grant execute on function find_waitlist_entry(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- promote_waitlist_entry: staff-only (tutor/super_admin, not ta). Reuses
-- create_booking's exact capacity-check/lock shape, creates a reserve_only
-- booking (tutor confirms payment manually afterwards, same as any other
-- cash reservation), and marks the waitlist row converted.
-- ----------------------------------------------------------------------------

create or replace function promote_waitlist_entry(p_waitlist_id uuid)
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
  v_waitlist waitlist_requests%rowtype;
  v_group groups%rowtype;
  v_caller_role text;
  v_caller_tutor_id uuid;
  v_active_count int;
  v_booking_code text;
  v_expires_at timestamptz;
  v_new_id uuid;
begin
  select role, tutor_id into v_caller_role, v_caller_tutor_id
  from admin_users where admin_users.id = auth.uid() and admin_users.is_active = true;

  if v_caller_role is null or v_caller_role = 'ta' then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  select * into v_waitlist from waitlist_requests where waitlist_requests.id = p_waitlist_id for update;
  if not found then
    raise exception 'WAITLIST_ENTRY_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_caller_role <> 'super_admin' and v_caller_tutor_id <> v_waitlist.tutor_id then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  if v_waitlist.status <> 'waiting' then
    raise exception 'NOT_WAITING' using errcode = 'P0001';
  end if;

  select * into v_group from groups where groups.id = v_waitlist.group_id for update;

  select count(*) into v_active_count
  from bookings
  where bookings.group_id = v_waitlist.group_id
    and bookings.archived_at is null
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
  v_expires_at := now() + interval '48 hours';

  insert into bookings (
    booking_code, student_name, student_phone, guardian_phone,
    grade_id, group_id, tutor_id, payment_method, payment_status, amount, expires_at
  ) values (
    v_booking_code, v_waitlist.student_name, v_waitlist.student_phone, v_waitlist.guardian_phone,
    v_waitlist.grade_id, v_waitlist.group_id, v_waitlist.tutor_id, 'reserve_only', 'pending',
    v_group.price, v_expires_at
  )
  returning bookings.id into v_new_id;

  update waitlist_requests
  set status = 'converted', converted_booking_id = v_new_id
  where waitlist_requests.id = p_waitlist_id;

  return query
    select v_new_id, v_booking_code, v_group.price, v_expires_at, v_waitlist.tutor_id;
end;
$$;

grant execute on function promote_waitlist_entry(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- notify_waitlist_seat_freed: called after any event that frees a seat
-- (archive, cancel, expiry) for a group that currently has waiting
-- entries. Cheap no-op when there's no waitlist or no free seat.
-- ----------------------------------------------------------------------------

create or replace function notify_waitlist_seat_freed(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group groups%rowtype;
  v_active_count int;
  v_waiting_count int;
  v_recipient record;
begin
  select * into v_group from groups where groups.id = p_group_id;
  if not found then
    return;
  end if;

  select count(*) into v_waiting_count
  from waitlist_requests where waitlist_requests.group_id = p_group_id and waitlist_requests.status = 'waiting';

  if v_waiting_count = 0 then
    return;
  end if;

  select count(*) into v_active_count
  from bookings
  where bookings.group_id = p_group_id
    and bookings.archived_at is null
    and (
      bookings.payment_status = 'paid'
      or (
        bookings.payment_status = 'pending'
        and (bookings.payment_method <> 'reserve_only' or bookings.expires_at > now())
      )
    );

  if v_active_count >= v_group.capacity then
    return;
  end if;

  for v_recipient in
    select admin_users.id from admin_users
    where admin_users.is_active = true
      and (
        (admin_users.tutor_id = v_group.tutor_id and admin_users.role = 'tutor')
        or admin_users.role = 'super_admin'
      )
  loop
    insert into notifications (tutor_id, recipient_admin_id, type, message)
    values (
      v_group.tutor_id, v_recipient.id, 'waitlist_seat_available',
      format('مكان فضى في مجموعة %s — فيه %s طالب في الانتظار', v_group.name, v_waiting_count)
    );
  end loop;
end;
$$;

grant execute on function notify_waitlist_seat_freed(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- expire_stale_reservations: rewritten to loop over the distinct groups
-- affected by this run and notify any of them that now have both a free
-- seat and a waitlist. Previously a single bulk UPDATE with no per-row
-- hook (see 0024) — now plpgsql so we can capture affected group_ids.
--
-- Deliberately NOT security definer, same as every prior definition of
-- this function (0001, 0024) — it runs invoker-rights, so anon/plain
-- authenticated calls only ever affect rows RLS already lets that role
-- touch (in practice: none directly), while the real bulk expiry happens
-- via the pg_cron job (superuser) and the nested call inside the
-- SECURITY DEFINER create_booking (definer's privileges). This rewrite
-- must not silently widen that privilege boundary. notify_waitlist_seat_freed
-- is its own SECURITY DEFINER function, so the notification fan-out still
-- works correctly regardless of which context actually performed the expiry.
-- ----------------------------------------------------------------------------

create or replace function expire_stale_reservations()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid;
begin
  for v_group_id in
    with expired as (
      update bookings
      set payment_status = 'expired'
      where payment_method = 'reserve_only'
        and payment_status = 'pending'
        and archived_at is null
        and expires_at is not null
        and expires_at < now()
      returning group_id
    )
    select distinct group_id from expired
  loop
    perform notify_waitlist_seat_freed(v_group_id);
  end loop;
end;
$$;

grant execute on function expire_stale_reservations() to anon, authenticated;
