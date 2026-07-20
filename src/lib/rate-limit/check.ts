import "server-only";
import { headers } from "next/headers";
import { createAnonServerClient } from "@/lib/supabase/server";

export { RATE_LIMIT_MESSAGE } from "./message";

/**
 * Vercel sets x-forwarded-for on every request; falls back to x-real-ip,
 * then a constant so local dev / missing-header cases still get a
 * (shared, coarser) bucket instead of throwing.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Fixed-window rate limit backed by the check_rate_limit() Postgres
 * function (see migration 0025) — reliable across Vercel's serverless
 * invocations, unlike an in-memory counter. Fails OPEN (allows the
 * request) if the check itself errors, so a database hiccup never blocks
 * real students from booking.
 */
export async function checkRateLimit(
  bucketKey: string,
  maxHits: number,
  windowSeconds: number
): Promise<boolean> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket_key: bucketKey,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });

  if (error) return true;
  return data === true;
}

const LOOKUP_LIMIT = { maxHits: 8, windowSeconds: 60 };
const BOOKING_LIMIT = { maxHits: 5, windowSeconds: 300 };
const FEEDBACK_LIMIT = { maxHits: 3, windowSeconds: 600 };

/**
 * Shared by every phone-lookup action (findEligibleBookings,
 * findActiveReservation) so they draw from ONE combined allowance per
 * user, regardless of which specific RPC ends up being called — a
 * student clicking "متابعة" repeatedly is rate-limited as a single
 * logical action, not per underlying function call.
 */
export async function checkLookupRateLimit(namespace: string, phone?: string | null): Promise<boolean> {
  const ip = await getClientIp();
  const ipOk = await checkRateLimit(`${namespace}:ip:${ip}`, LOOKUP_LIMIT.maxHits, LOOKUP_LIMIT.windowSeconds);
  if (!ipOk) return false;

  if (phone) {
    const phoneOk = await checkRateLimit(
      `${namespace}:phone:${phone}`,
      LOOKUP_LIMIT.maxHits,
      LOOKUP_LIMIT.windowSeconds
    );
    if (!phoneOk) return false;
  }

  return true;
}

export async function checkBookingRateLimit(phone: string): Promise<boolean> {
  const ip = await getClientIp();
  const ipOk = await checkRateLimit(`booking:ip:${ip}`, BOOKING_LIMIT.maxHits, BOOKING_LIMIT.windowSeconds);
  if (!ipOk) return false;

  const phoneOk = await checkRateLimit(`booking:phone:${phone}`, BOOKING_LIMIT.maxHits, BOOKING_LIMIT.windowSeconds);
  if (!phoneOk) return false;

  return true;
}

/**
 * IP-only (sender phone is optional on the feedback form, so it can't be
 * relied on as a bucket key) — a few submissions per 10 minutes is plenty
 * for a real visitor while blocking a flood.
 */
export async function checkFeedbackRateLimit(): Promise<boolean> {
  const ip = await getClientIp();
  return checkRateLimit(`feedback:ip:${ip}`, FEEDBACK_LIMIT.maxHits, FEEDBACK_LIMIT.windowSeconds);
}
