-- ============================================================================
-- Pre-launch payment mode: lets a tutor keep online payments (card/wallet/
-- Fawry) hidden/disabled while still accepting bookings on a cash basis.
-- Reuses the existing "settings" table/RLS (already anon-readable for
-- active tutors, already tutor/super-admin writable) rather than adding a
-- new table, since this is operationally the same shape as
-- booking_open/monthly_payment_open.
-- ============================================================================

alter table settings
  add column online_payments_enabled boolean not null default false;
