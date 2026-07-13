import Link from "next/link";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { MonthlyPaymentsTable, type MatrixRow } from "@/components/admin/MonthlyPaymentsTable";

export default async function AdminMonthlyPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tutor?: string; month?: string; grade?: string; group?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createAdminServerClient();
  const { tutorId, isSuperAdmin } = await getCurrentAdmin();

  let defaultMonth = new Date().toISOString().slice(0, 7);
  if (tutorId) {
    const { data: settings } = await supabase
      .from("settings")
      .select("current_month")
      .eq("tutor_id", tutorId)
      .maybeSingle();
    if (settings?.current_month) defaultMonth = settings.current_month;
  }

  const month = params.month || defaultMonth;

  const [{ data: matrix }, { data: grades }, { data: groups }, { data: tutors }] = await Promise.all([
    supabase.rpc("get_monthly_payment_matrix", { p_month: month }),
    supabase.from("grades").select("id, name, display_order, is_active, tutor_id").order("display_order"),
    supabase.from("groups").select("id, name, grade_id, tutor_id").order("name"),
    isSuperAdmin ? supabase.from("tutors").select("id, name").order("name") : Promise.resolve({ data: [] }),
  ]);

  let rows = (matrix ?? []) as MatrixRow[];

  if (isSuperAdmin && params.tutor) rows = rows.filter((r) => r.tutor_id === params.tutor);
  if (params.grade) rows = rows.filter((r) => r.grade_id === params.grade);
  if (params.group) rows = rows.filter((r) => r.group_id === params.group);
  if (params.q) {
    const q = params.q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.student_name.toLowerCase().includes(q) ||
        r.student_phone.includes(q) ||
        r.booking_code.toLowerCase().includes(q)
    );
  }

  const allGrades = grades ?? [];
  const allGroups = groups ?? [];
  const gradeOptions =
    isSuperAdmin && params.tutor ? allGrades.filter((g) => g.tutor_id === params.tutor) : allGrades;
  const groupOptions =
    isSuperAdmin && params.tutor ? allGroups.filter((g) => g.tutor_id === params.tutor) : allGroups;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">المدفوعات الشهرية</h1>
        <Link
          href={`/api/admin/export-monthly${params.tutor ? `?tutor=${params.tutor}` : ""}`}
          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          تصدير إلى Excel
        </Link>
      </div>
      <MonthlyPaymentsTable
        rows={rows}
        grades={gradeOptions}
        groups={groupOptions}
        tutors={tutors ?? []}
        month={month}
        isSuperAdmin={isSuperAdmin}
        filters={{
          tutor: params.tutor ?? "",
          grade: params.grade ?? "",
          group: params.group ?? "",
          q: params.q ?? "",
        }}
      />
    </div>
  );
}
