import Link from "next/link";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { BookingsTable, type AdminBooking } from "@/components/admin/BookingsTable";

const PAGE_SIZE = 20;

interface BookingRow {
  id: string;
  booking_code: string;
  student_name: string;
  student_phone: string;
  guardian_phone: string;
  payment_method: string;
  payment_status: string;
  amount: number;
  created_at: string;
  tutor_id: string;
  grades: { name: string } | { name: string }[] | null;
  groups: { name: string } | { name: string }[] | null;
  tutors: { name: string } | { name: string }[] | null;
}

interface GradeOptionRow {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  tutor_id: string;
}

interface GroupOptionRow {
  id: string;
  name: string;
  grade_id: string;
  tutor_id: string;
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tutor?: string;
    grade?: string;
    group?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { isTa, isSuperAdmin } = await getCurrentAdmin();
  const supabase = await createAdminServerClient();
  await supabase.rpc("expire_stale_reservations");

  let query = supabase
    .from("bookings")
    .select(
      "id, booking_code, student_name, student_phone, guardian_phone, payment_method, payment_status, amount, created_at, tutor_id, grades(name), groups(name), tutors(name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (isSuperAdmin && params.tutor) query = query.eq("tutor_id", params.tutor);
  if (params.grade) query = query.eq("grade_id", params.grade);
  if (params.group) query = query.eq("group_id", params.group);
  if (params.status) query = query.eq("payment_status", params.status);
  if (params.q) {
    const q = params.q.trim();
    query = query.or(
      `student_name.ilike.%${q}%,student_phone.ilike.%${q}%,guardian_phone.ilike.%${q}%,booking_code.ilike.%${q}%`
    );
  }

  const [{ data: rows, count }, { data: gradeRows }, { data: groupRows }, { data: tutors }] =
    await Promise.all([
      query.range(from, to),
      supabase.from("grades").select("id, name, display_order, is_active, tutor_id").order("display_order"),
      supabase.from("groups").select("id, name, grade_id, tutor_id").order("name"),
      isSuperAdmin ? supabase.from("tutors").select("id, name").order("name") : Promise.resolve({ data: [] }),
    ]);

  const bookings: AdminBooking[] = ((rows ?? []) as BookingRow[]).map((row) => {
    const gradeInfo = Array.isArray(row.grades) ? row.grades[0] : row.grades;
    const groupInfo = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    const tutorInfo = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return {
      id: row.id,
      booking_code: row.booking_code,
      student_name: row.student_name,
      student_phone: row.student_phone,
      guardian_phone: row.guardian_phone,
      payment_method: row.payment_method,
      payment_status: row.payment_status,
      amount: row.amount,
      created_at: row.created_at,
      grade_name: gradeInfo?.name ?? "غير معروف",
      group_name: groupInfo?.name ?? "غير معروف",
      tutor_id: row.tutor_id,
      tutor_name: tutorInfo?.name ?? "غير معروف",
    };
  });

  const allGrades = (gradeRows ?? []) as GradeOptionRow[];
  const allGroups = (groupRows ?? []) as GroupOptionRow[];

  // For a tutor/ta these are already scoped to their own tutor via RLS. For
  // a super admin with a tutor filter selected, narrow the dropdown options
  // to that tutor so grade/group choices stay meaningful.
  const gradeOptions = isSuperAdmin && params.tutor ? allGrades.filter((g) => g.tutor_id === params.tutor) : allGrades;
  const groupOptions = isSuperAdmin && params.tutor ? allGroups.filter((g) => g.tutor_id === params.tutor) : allGroups;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">الحجوزات</h1>
        <Link
          href={`/api/admin/export${params.tutor ? `?tutor=${params.tutor}` : ""}`}
          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          تصدير إلى Excel
        </Link>
      </div>
      <BookingsTable
        bookings={bookings}
        grades={gradeOptions}
        groups={groupOptions}
        tutors={tutors ?? []}
        totalCount={count ?? 0}
        pageSize={PAGE_SIZE}
        currentPage={page}
        filters={{
          tutor: params.tutor ?? "",
          grade: params.grade ?? "",
          group: params.group ?? "",
          status: params.status ?? "",
          q: params.q ?? "",
        }}
        isSuperAdmin={isSuperAdmin}
        readOnly={isTa}
      />
    </div>
  );
}
