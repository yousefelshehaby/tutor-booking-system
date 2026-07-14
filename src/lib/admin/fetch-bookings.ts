import "server-only";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import type { AdminBooking } from "@/components/admin/BookingsTable";

export interface AdminBookingsFilters {
  tutor?: string;
  grade?: string;
  group?: string;
  status?: string;
  q?: string;
}

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
  grade_id: string;
  group_id: string;
  grades: { name: string } | { name: string }[] | null;
  groups: { name: string; days: string; time: string } | { name: string; days: string; time: string }[] | null;
  tutors: { name: string } | { name: string }[] | null;
}

export interface GradeOptionRow {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  tutor_id: string;
}

export interface GroupOptionRow {
  id: string;
  name: string;
  grade_id: string;
  tutor_id: string;
}

export interface AdminBookingRow extends AdminBooking {
  grade_id: string;
  group_id: string;
  group_days: string;
  group_time: string;
}

export interface FetchAdminBookingsResult {
  bookings: AdminBookingRow[];
  gradeOptions: GradeOptionRow[];
  groupOptions: GroupOptionRow[];
  tutors: { id: string; name: string }[];
  totalCount: number;
}

/**
 * Shared by الحجوزات (operations view) and طلابي (person-centric view) —
 * same filters/search/RLS-scoping, just rendered differently.
 */
export async function fetchAdminBookings(
  filters: AdminBookingsFilters & { page: number; pageSize: number },
  ctx: { isSuperAdmin: boolean }
): Promise<FetchAdminBookingsResult> {
  const { page, pageSize, ...params } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createAdminServerClient();
  await supabase.rpc("expire_stale_reservations");

  let query = supabase
    .from("bookings")
    .select(
      "id, booking_code, student_name, student_phone, guardian_phone, payment_method, payment_status, amount, created_at, tutor_id, grade_id, group_id, grades(name), groups(name, days, time), tutors(name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (ctx.isSuperAdmin && params.tutor) query = query.eq("tutor_id", params.tutor);
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
      ctx.isSuperAdmin ? supabase.from("tutors").select("id, name").order("name") : Promise.resolve({ data: [] }),
    ]);

  const bookings: AdminBookingRow[] = ((rows ?? []) as BookingRow[]).map((row) => {
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
      grade_id: row.grade_id,
      group_id: row.group_id,
      group_days: groupInfo?.days ?? "",
      group_time: groupInfo?.time ?? "",
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
  const gradeOptions =
    ctx.isSuperAdmin && params.tutor ? allGrades.filter((g) => g.tutor_id === params.tutor) : allGrades;
  const groupOptions =
    ctx.isSuperAdmin && params.tutor ? allGroups.filter((g) => g.tutor_id === params.tutor) : allGroups;

  return { bookings, gradeOptions, groupOptions, tutors: tutors ?? [], totalCount: count ?? 0 };
}
