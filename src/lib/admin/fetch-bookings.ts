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
  archived_at: string | null;
  grades: { name: string } | { name: string }[] | null;
  groups: { name: string; days: string; time: string } | { name: string; days: string; time: string }[] | null;
  tutors: { name: string } | { name: string }[] | null;
  admin_users: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null;
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
  archived_at: string | null;
  archived_by_name: string | null;
  previousArchivedBooking: { booking_code: string; archived_at: string } | null;
}

export interface FetchAdminBookingsResult {
  bookings: AdminBookingRow[];
  gradeOptions: GradeOptionRow[];
  groupOptions: GroupOptionRow[];
  tutors: { id: string; name: string }[];
  totalCount: number;
}

/**
 * Shared by الحجوزات (operations view) and طلابي (person-centric view,
 * including its "الأرشيف" tab) — same filters/search/RLS-scoping, just
 * rendered differently. `archived: true` flips to listing ONLY archived
 * students instead of excluding them.
 */
export async function fetchAdminBookings(
  filters: AdminBookingsFilters & { page: number; pageSize: number },
  ctx: { isSuperAdmin: boolean; archived?: boolean }
): Promise<FetchAdminBookingsResult> {
  const { page, pageSize, ...params } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createAdminServerClient();
  await supabase.rpc("expire_stale_reservations");

  let query = supabase
    .from("bookings")
    .select(
      "id, booking_code, student_name, student_phone, guardian_phone, payment_method, payment_status, amount, created_at, tutor_id, grade_id, group_id, archived_at, grades(name), groups(name, days, time), tutors(name), admin_users(name, email)",
      { count: "exact" }
    )
    .order(ctx.archived ? "archived_at" : "created_at", { ascending: false });

  query = ctx.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

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

  const typedRows = (rows ?? []) as BookingRow[];

  // "طالب سابق": for each active (non-archived) row, check whether an
  // archived booking exists for the same tutor + phone — batched in one
  // query rather than N+1.
  const previousArchivedByKey = new Map<string, { booking_code: string; archived_at: string }>();
  if (!ctx.archived && typedRows.length > 0) {
    const tutorIds = Array.from(new Set(typedRows.map((r) => r.tutor_id)));
    const phones = Array.from(
      new Set(typedRows.flatMap((r) => [r.student_phone, r.guardian_phone]))
    );

    const { data: archivedMatches } = await supabase
      .from("bookings")
      .select("tutor_id, student_phone, guardian_phone, booking_code, archived_at")
      .in("tutor_id", tutorIds)
      .not("archived_at", "is", null)
      .or(phones.map((p) => `student_phone.eq.${p},guardian_phone.eq.${p}`).join(","));

    for (const match of archivedMatches ?? []) {
      for (const phone of [match.student_phone, match.guardian_phone]) {
        const key = `${match.tutor_id}:${phone}`;
        const existing = previousArchivedByKey.get(key);
        if (!existing || match.archived_at > existing.archived_at) {
          previousArchivedByKey.set(key, { booking_code: match.booking_code, archived_at: match.archived_at });
        }
      }
    }
  }

  const bookings: AdminBookingRow[] = typedRows.map((row) => {
    const gradeInfo = Array.isArray(row.grades) ? row.grades[0] : row.grades;
    const groupInfo = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    const tutorInfo = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    const archiverInfo = Array.isArray(row.admin_users) ? row.admin_users[0] : row.admin_users;

    const previous =
      previousArchivedByKey.get(`${row.tutor_id}:${row.student_phone}`) ??
      previousArchivedByKey.get(`${row.tutor_id}:${row.guardian_phone}`) ??
      null;

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
      archived_at: row.archived_at,
      archived_by_name: archiverInfo?.name ?? archiverInfo?.email ?? null,
      previousArchivedBooking: previous,
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
