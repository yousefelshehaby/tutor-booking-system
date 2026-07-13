import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cookie-bound client for use in admin Server Components/Actions. Runs with
 * the logged-in admin's session, so RLS's "authenticated full access"
 * policies apply naturally — no service-role key needed here.
 */
export async function createAdminServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render — cookies can't be
            // mutated there. Middleware refreshes the session instead.
          }
        },
      },
    }
  );
}
