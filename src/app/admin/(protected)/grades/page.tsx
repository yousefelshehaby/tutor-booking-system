import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { GradesManager } from "@/components/admin/GradesManager";

export default async function AdminGradesPage() {
  const supabase = await createAdminServerClient();
  const { data: grades } = await supabase
    .from("grades")
    .select("id, name, display_order, is_active")
    .order("display_order", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">الصفوف الدراسية</h1>
      <GradesManager grades={grades ?? []} />
    </div>
  );
}
