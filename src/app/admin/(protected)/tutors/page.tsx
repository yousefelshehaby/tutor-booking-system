import { redirect } from "next/navigation";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { TutorsManager } from "@/components/admin/TutorsManager";

export default async function AdminTutorsPage() {
  const { isSuperAdmin, tutorId } = await getCurrentAdmin();
  if (!isSuperAdmin) {
    redirect("/admin/dashboard");
  }

  const supabase = await createAdminServerClient();
  const { data: tutors } = await supabase
    .from("tutors")
    .select("id, name, slug, phone, is_active")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">المدرّسون</h1>
      <TutorsManager tutors={tutors ?? []} activeTutorId={tutorId} />
    </div>
  );
}
