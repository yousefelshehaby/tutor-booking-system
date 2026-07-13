import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Anon-key client for server-side code that talks to Supabase on behalf of
 * the public (unauthenticated) student flow. Security is enforced by RLS
 * policies and the SECURITY DEFINER RPC functions, not by this client.
 */
export function createAnonServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
