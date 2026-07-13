import { createAdminServerClient } from "@/lib/supabase/admin-server";
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
  grades: { name: string } | { name: string }[] | null;
  groups: { name: string } | { name: string }[] | null;
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
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

  const supabase = await createAdminServerClient();
  await supabase.rpc("expire_stale_reservations");

  let query = supabase
    .from("bookings")
    .select(
      "id, booking_code, student_name, student_phone, guardian_phone, payment_method, payment_status, amount, created_at, grades(name), groups(name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (params.grade) query = query.eq("grade_id", params.grade);
  if (params.group) query = query.eq("group_id", params.group);
  if (params.status) query = query.eq("payment_status", params.status);
  if (params.q) {
    const q = params.q.trim();
    query = query.or(
      `student_name.ilike.%${q}%,student_phone.ilike.%${q}%,guardian_phone.ilike.%${q}%,booking_code.ilike.%${q}%`
    );
  }

  const [{ data: rows, count }, { data: grades }, { data: groups }] = await Promise.all([
    query.range(from, to),
    supabase.from("grades").select("id, name, display_order, is_active").order("display_order"),
    supabase.from("groups").select("id, name, grade_id").order("name"),
  ]);

  const bookings: AdminBooking[] = ((rows ?? []) as BookingRow[]).map((row) => {
    const gradeInfo = Array.isArray(row.grades) ? row.grades[0] : row.grades;
    const groupInfo = Array.isArray(row.groups) ? row.groups[0] : row.groups;
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
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">الحجوزات</h1>
        <a
          href="/api/admin/export"
          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          تصدير إلى Excel
        </a>
      </div>
      <BookingsTable
        bookings={bookings}
        grades={grades ?? []}
        groups={groups ?? []}
        totalCount={count ?? 0}
        pageSize={PAGE_SIZE}
        currentPage={page}
        filters={{
          grade: params.grade ?? "",
          group: params.group ?? "",
          status: params.status ?? "",
          q: params.q ?? "",
        }}
      />
    </div>
  );
}
