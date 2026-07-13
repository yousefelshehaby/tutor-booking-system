import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { GradesManager, type AdminGrade } from "@/components/admin/GradesManager";

interface GradeRow {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  tutor_id: string;
  tutors: { name: string } | { name: string }[] | null;
}

export default async function AdminGradesPage() {
  const { isSuperAdmin } = await getCurrentAdmin();
  const supabase = await createAdminServerClient();

  const [{ data: gradeRows }, { data: tutors }] = await Promise.all([
    supabase
      .from("grades")
      .select("id, name, display_order, is_active, tutor_id, tutors(name)")
      .order("display_order", { ascending: true }),
    isSuperAdmin
      ? supabase.from("tutors").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const grades: AdminGrade[] = ((gradeRows ?? []) as GradeRow[]).map((row) => {
    const tutorInfo = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return {
      id: row.id,
      name: row.name,
      display_order: row.display_order,
      is_active: row.is_active,
      tutor_id: row.tutor_id,
      tutor_name: tutorInfo?.name ?? "غير معروف",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">الصفوف الدراسية</h1>
      <GradesManager grades={grades} isSuperAdmin={isSuperAdmin} tutors={tutors ?? []} />
    </div>
  );
}
