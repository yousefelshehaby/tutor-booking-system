import { NextRequest, NextResponse } from "next/server";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { buildMonthlyWorkbook } from "@/lib/excel/build-monthly-workbook";

interface BookingRow {
  id: string;
  booking_code: string;
  student_name: string;
  grade_id: string;
  group_id: string;
  created_at: string;
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

  const { tutorId, isSuperAdmin } = await getCurrentAdmin();
  const tutorFilter = isSuperAdmin ? request.nextUrl.searchParams.get("tutor") : null;

  // Only meaningful when scoped to a single tutor (each tutor has its own
  // current_month) — an unfiltered cross-tutor export just uses today.
  let currentMonth = new Date().toISOString().slice(0, 7);
  const settingsTutorId = tutorFilter ?? tutorId;
  if (settingsTutorId) {
    const { data: settings } = await supabase
      .from("settings")
      .select("current_month")
      .eq("tutor_id", settingsTutorId)
      .maybeSingle();
    if (settings?.current_month) currentMonth = settings.current_month;
  }

  let gradesQuery = supabase.from("grades").select("id, name, display_order");
  let groupsQuery = supabase.from("groups").select("id, grade_id, name, days, time");
  let bookingsQuery = supabase
    .from("bookings")
    .select("id, booking_code, student_name, grade_id, group_id, created_at, tutors(name)")
    .eq("payment_status", "paid")
    .is("archived_at", null);

  if (tutorFilter) {
    gradesQuery = gradesQuery.eq("tutor_id", tutorFilter);
    groupsQuery = groupsQuery.eq("tutor_id", tutorFilter);
    bookingsQuery = bookingsQuery.eq("tutor_id", tutorFilter);
  }

  const [{ data: grades }, { data: groups }, { data: bookingRows }, { data: monthlyPayments }] =
    await Promise.all([
      gradesQuery,
      groupsQuery,
      bookingsQuery,
      supabase.from("monthly_payments").select("booking_id, month, payment_status"),
    ]);

  const includeTutorColumn = isSuperAdmin && !tutorFilter;
  const bookings = ((bookingRows ?? []) as BookingRow[]).map((row) => {
    const tutorInfo = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return { ...row, tutor_name: tutorInfo?.name ?? "غير معروف" };
  });

  const buffer = await buildMonthlyWorkbook({
    grades: grades ?? [],
    groups: groups ?? [],
    bookings,
    monthlyPayments: monthlyPayments ?? [],
    currentMonth,
    includeTutorColumn,
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="monthly-payments-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
