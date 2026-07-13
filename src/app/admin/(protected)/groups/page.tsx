import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { GroupsManager, type AdminGroup } from "@/components/admin/GroupsManager";
import type { AdminGrade } from "@/components/admin/GradesManager";

interface GroupRow {
  id: string;
  grade_id: string;
  name: string;
  days: string;
  time: string;
  capacity: number;
  price: number;
  monthly_fee: number | null;
  is_active: boolean;
  tutor_id: string;
  grades: { name: string } | { name: string }[] | null;
  tutors: { name: string } | { name: string }[] | null;
}

interface GradeRow {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  tutor_id: string;
  tutors: { name: string } | { name: string }[] | null;
}

export default async function AdminGroupsPage() {
  const { isSuperAdmin } = await getCurrentAdmin();
  const supabase = await createAdminServerClient();

  const [{ data: groupRows }, { data: gradeRows }, { data: tutors }] = await Promise.all([
    supabase
      .from("groups")
      .select(
        "id, grade_id, name, days, time, capacity, price, monthly_fee, is_active, tutor_id, grades(name), tutors(name)"
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("grades")
      .select("id, name, display_order, is_active, tutor_id, tutors(name)")
      .order("display_order"),
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

  const groups: AdminGroup[] = ((groupRows ?? []) as GroupRow[]).map((row) => {
    const gradeInfo = Array.isArray(row.grades) ? row.grades[0] : row.grades;
    const tutorInfo = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return {
      id: row.id,
      grade_id: row.grade_id,
      name: row.name,
      days: row.days,
      time: row.time,
      capacity: row.capacity,
      price: row.price,
      monthly_fee: row.monthly_fee,
      is_active: row.is_active,
      grade_name: gradeInfo?.name ?? "غير معروف",
      tutor_id: row.tutor_id,
      tutor_name: tutorInfo?.name ?? "غير معروف",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">المجموعات</h1>
      <GroupsManager groups={groups} grades={grades} isSuperAdmin={isSuperAdmin} tutors={tutors ?? []} />
    </div>
  );
}
