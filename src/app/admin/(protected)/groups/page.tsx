import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { GroupsManager, type AdminGroup } from "@/components/admin/GroupsManager";

interface GroupRow {
  id: string;
  grade_id: string;
  name: string;
  days: string;
  time: string;
  capacity: number;
  price: number;
  is_active: boolean;
  grades: { name: string } | { name: string }[] | null;
}

export default async function AdminGroupsPage() {
  const supabase = await createAdminServerClient();

  const [{ data: groupRows }, { data: grades }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, grade_id, name, days, time, capacity, price, is_active, grades(name)")
      .order("created_at", { ascending: true }),
    supabase.from("grades").select("id, name, display_order, is_active").order("display_order"),
  ]);

  const groups: AdminGroup[] = ((groupRows ?? []) as GroupRow[]).map((row) => {
    const gradeInfo = Array.isArray(row.grades) ? row.grades[0] : row.grades;
    return {
      id: row.id,
      grade_id: row.grade_id,
      name: row.name,
      days: row.days,
      time: row.time,
      capacity: row.capacity,
      price: row.price,
      is_active: row.is_active,
      grade_name: gradeInfo?.name ?? "غير معروف",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">المجموعات</h1>
      <GroupsManager groups={groups} grades={grades ?? []} />
    </div>
  );
}
