import { NextRequest, NextResponse } from "next/server";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { buildBookingsWorkbook } from "@/lib/excel/build-workbook";

interface BookingRow {
  booking_code: string;
  student_name: string;
  student_phone: string;
  guardian_phone: string;
  payment_method: string;
  payment_status: string;
  amount: number;
  created_at: string;
  group_id: string;
  tutors: { name: string } | { name: string }[] | null;
}

export async function GET(request: NextRequest) {
  const supabase = await createAdminServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 401 });
  }

  const { isSuperAdmin } = await getCurrentAdmin();
  const tutorFilter = isSuperAdmin ? request.nextUrl.searchParams.get("tutor") : null;

  await supabase.rpc("expire_stale_reservations");

  let gradesQuery = supabase.from("grades").select("id, name, display_order");
  let groupsQuery = supabase.from("groups").select("id, grade_id, name, days, time");
  let bookingsQuery = supabase
    .from("bookings")
    .select(
      "booking_code, student_name, student_phone, guardian_phone, payment_method, payment_status, amount, created_at, group_id, tutors(name)"
    );

  if (tutorFilter) {
    gradesQuery = gradesQuery.eq("tutor_id", tutorFilter);
    groupsQuery = groupsQuery.eq("tutor_id", tutorFilter);
    bookingsQuery = bookingsQuery.eq("tutor_id", tutorFilter);
  }

  const [{ data: grades }, { data: groups }, { data: bookingRows }] = await Promise.all([
    gradesQuery,
    groupsQuery,
    bookingsQuery,
  ]);

  const includeTutorColumn = isSuperAdmin && !tutorFilter;
  const bookings = ((bookingRows ?? []) as BookingRow[]).map((row) => {
    const tutorInfo = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return { ...row, tutor_name: tutorInfo?.name ?? "غير معروف" };
  });

  const buffer = await buildBookingsWorkbook({
    grades: grades ?? [],
    groups: groups ?? [],
    bookings,
    includeTutorColumn,
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
