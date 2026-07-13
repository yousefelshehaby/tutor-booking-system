import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client that bypasses RLS. Only ever import this from
 * server-only code (route handlers, server actions) that has a specific,
 * narrow reason to write to tables the public/anon role cannot touch
 * (e.g. marking a booking paid from the Paymob webhook). Never expose this
 * key or this client to the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service role environment variables");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
