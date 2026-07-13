import { redirect } from "next/navigation";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { TAsManager, type AdminTa } from "@/components/admin/TAsManager";

interface TaRow {
  id: string;
  email: string | null;
  is_active: boolean;
  tutor_id: string;
  tutors: { name: string } | { name: string }[] | null;
}

export default async function AdminTasPage() {
  const { role, tutorId, isSuperAdmin } = await getCurrentAdmin();
  if (role !== "tutor" && role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  const supabase = await createAdminServerClient();

  let query = supabase
    .from("admin_users")
    .select("id, email, is_active, tutor_id, tutors(name)")
    .eq("role", "ta")
    .order("email");

  // A tutor only ever sees their own TAs. A super admin sees every TA
  // across every tutor (no need to switch first).
  if (!isSuperAdmin) {
    if (!tutorId) {
      return (
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl font-bold text-zinc-900">المساعدون</h1>
          <p className="text-zinc-500">هذا الحساب غير مرتبط بمدرّس</p>
        </div>
      );
    }
    query = query.eq("tutor_id", tutorId);
  }

  const [{ data: taRows }, { data: tutors }] = await Promise.all([
    query,
    isSuperAdmin
      ? supabase.from("tutors").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const tas: AdminTa[] = ((taRows ?? []) as TaRow[]).map((row) => {
    const tutorInfo = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return {
      id: row.id,
      email: row.email,
      is_active: row.is_active,
      tutor_id: row.tutor_id,
      tutor_name: tutorInfo?.name ?? "غير معروف",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">المساعدون</h1>
      <TAsManager tas={tas} canCreate={isSuperAdmin} isSuperAdmin={isSuperAdmin} tutors={tutors ?? []} />
    </div>
  );
}
