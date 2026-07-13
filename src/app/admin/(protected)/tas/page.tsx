import { redirect } from "next/navigation";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { TAsManager } from "@/components/admin/TAsManager";

export default async function AdminTasPage() {
  const { role, tutorId } = await getCurrentAdmin();
  if (role !== "tutor" && role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  const supabase = await createAdminServerClient();
  const { data: tas } = tutorId
    ? await supabase
        .from("admin_users")
        .select("id, email, is_active")
        .eq("tutor_id", tutorId)
        .eq("role", "ta")
        .order("email")
    : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">المساعدون</h1>
      <TAsManager tas={tas ?? []} canCreate={role === "super_admin"} />
    </div>
  );
}
