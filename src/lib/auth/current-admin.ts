import "server-only";
import { createAdminServerClient } from "@/lib/supabase/admin-server";

export type AdminRole = "tutor" | "ta" | "super_admin";

export interface CurrentAdmin {
  id: string | null;
  tutorId: string | null;
  role: AdminRole | null;
  name: string | null;
  isSuperAdmin: boolean;
  isTa: boolean;
  isActive: boolean;
}

const EMPTY_ADMIN: CurrentAdmin = {
  id: null,
  tutorId: null,
  role: null,
  name: null,
  isSuperAdmin: false,
  isTa: false,
  isActive: false,
};

/**
 * Looks up the logged-in admin's role/tutor scope. Every admin mutation
 * that creates a new row (grades, groups) must set tutor_id explicitly
 * from this — RLS enforces that reads/updates/deletes stay within that
 * scope, but it can't invent a tutor_id for a fresh INSERT. Mutations must
 * also check `role` themselves before writing, since a TA's RLS grants are
 * read-only but a careless server action could still attempt a write and
 * get a confusing RLS error instead of a clear Arabic message.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin> {
  const supabase = await createAdminServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return EMPTY_ADMIN;
  }

  const { data } = await supabase
    .from("admin_users")
    .select("tutor_id, role, is_active, name")
    .eq("id", user.id)
    .single();

  if (!data) {
    return EMPTY_ADMIN;
  }

  const role = data.role as AdminRole;

  return {
    id: user.id,
    tutorId: data.tutor_id,
    role,
    name: data.name,
    isSuperAdmin: role === "super_admin",
    isTa: role === "ta",
    isActive: data.is_active,
  };
}
