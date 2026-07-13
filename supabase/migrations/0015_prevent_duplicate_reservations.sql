-- ============================================================================
-- Bug: a student who chose "reserve without paying" could re-enter the same
-- phone on the landing page and book AGAIN, since find_eligible_bookings
-- only ever matched PAID bookings — an active unpaid reservation was
-- invisible to the phone-first lookup, so the student always fell through
-- to "احجز لأول مرة" and created a duplicate hold on a seat.
--
-- find_active_reservation lets the phone-first entry recognize an existing
-- ACTIVE (not yet paid, not expired, not cancelled) reservation for this
-- phone + tutor, so it can show that reservation instead of offering a new
-- booking. "Active" mirrors the exact definition already used for seat
-- counting in create_booking/get_groups_with_availability: paid bookings
-- are excluded here on purpose (those go through find_eligible_bookings),
-- reserve_only rows only count while unexpired, and any other pending
-- (card/wallet/fawry started but never completed) always counts since it
-- never auto-expires.
-- ============================================================================

create or replace function find_active_reservation(p_tutor_id uuid, p_phone text)
returns table (
  booking_id uuid,
  booking_code text,
  student_name text,
  payment_method payment_method,
  amount numeric,
  expires_at timestamptz,
  grade_name text,
  group_name text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    b.booking_code,
    b.student_name,
    b.payment_method,
    b.amount,
    b.expires_at,
    gr.name,
    gp.name
  from bookings b
  join grades gr on gr.id = b.grade_id
  join groups gp on gp.id = b.group_id
  where b.tutor_id = p_tutor_id
    and (b.student_phone = p_phone or b.guardian_phone = p_phone)
    and b.payment_status = 'pending'
    and (b.payment_method <> 'reserve_only' or b.expires_at > now())
  order by b.created_at desc
  limit 1;
$$;

grant execute on function find_active_reservation(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- start_reservation_payment: lets a student complete payment on an existing
-- "reserve without paying" hold by picking a payment method now, instead of
-- creating a brand new booking. Reuses the SAME booking row/booking_code
-- (so it stays the single source of truth for that seat) — just switches
-- payment_method off reserve_only and clears the 48h expiry, since the
-- student is now actively paying.
-- ----------------------------------------------------------------------------

create or replace function start_reservation_payment(
  p_tutor_id uuid,
  p_booking_code text,
  p_payment_method payment_method
)
returns table (
  id uuid,
  booking_code text,
  amount numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking bookings%rowtype;
begin
  perform expire_stale_reservations();

  select * into v_booking from bookings
    where bookings.booking_code = p_booking_code and bookings.tutor_id = p_tutor_id
    for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_booking.payment_status <> 'pending' or v_booking.payment_method <> 'reserve_only' then
    raise exception 'RESERVATION_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  if v_booking.expires_at is not null and v_booking.expires_at < now() then
    raise exception 'RESERVATION_EXPIRED' using errcode = 'P0001';
  end if;

  if p_payment_method = 'reserve_only' then
    raise exception 'RESERVATION_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  update bookings
    set payment_method = p_payment_method, expires_at = null
    where bookings.id = v_booking.id;

  return query select v_booking.id, v_booking.booking_code, v_booking.amount;
end;
$$;

grant execute on function start_reservation_payment(uuid, text, payment_method) to anon, authenticated;
