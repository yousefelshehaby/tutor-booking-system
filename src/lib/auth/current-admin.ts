import "server-only";
import { createAdminServerClient } from "@/lib/supabase/admin-server";

export interface CurrentAdmin {
  tutorId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Looks up the logged-in admin's tutor scope. Every admin mutation that
 * creates a new row (grades, groups) must set tutor_id explicitly from
 * this — RLS enforces that reads/updates/deletes stay within that scope,
 * but it can't invent a tutor_id for a fresh INSERT.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin> {
  const supabase = await createAdminServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { tutorId: null, isSuperAdmin: false };
  }

  const { data } = await supabase
    .from("admin_users")
    .select("tutor_id, is_super_admin")
    .eq("id", user.id)
    .single();

  return {
    tutorId: data?.tutor_id ?? null,
    isSuperAdmin: data?.is_super_admin ?? false,
  };
}
