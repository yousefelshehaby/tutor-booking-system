-- ============================================================================
-- Lazy + scheduled expiry for reserve_only bookings
-- ============================================================================

grant execute on function expire_stale_reservations() to anon, authenticated;

-- Also expire stale reservations at the start of every booking attempt, so
-- the persisted payment_status stays accurate even without a page view
-- triggering the lazy-expiry calls added in the app layer.
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
  perform expire_stale_reservations();

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
-- Scheduled backup: expire stale reservations every 15 minutes even if no
-- one visits a page that would otherwise trigger it lazily. Requires the
-- pg_cron extension, available on all Supabase plans under
-- Database > Extensions. If it's not available in your project, skip this
-- block — the lazy expiry above still covers every real user-facing path.
-- ----------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'expire-stale-reservations',
  '*/15 * * * *',
  $$select expire_stale_reservations();$$
);
