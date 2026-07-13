import { NextResponse } from "next/server";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { buildMonthlyWorkbook } from "@/lib/excel/build-monthly-workbook";

export async function GET() {
  const supabase = await createAdminServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 401 });
  }

  const { tutorId } = await getCurrentAdmin();
  let currentMonth = new Date().toISOString().slice(0, 7);
  if (tutorId) {
    const { data: settings } = await supabase
      .from("settings")
      .select("current_month")
      .eq("tutor_id", tutorId)
      .maybeSingle();
    if (settings?.current_month) currentMonth = settings.current_month;
  }

  const [{ data: grades }, { data: groups }, { data: bookings }, { data: monthlyPayments }] =
    await Promise.all([
      supabase.from("grades").select("id, name, display_order"),
      supabase.from("groups").select("id, grade_id, name, days, time"),
      supabase
        .from("bookings")
        .select("id, booking_code, student_name, grade_id, group_id, created_at")
        .eq("payment_status", "paid"),
      supabase.from("monthly_payments").select("booking_id, month, payment_status"),
    ]);

  const buffer = await buildMonthlyWorkbook({
    grades: grades ?? [],
    groups: groups ?? [],
    bookings: bookings ?? [],
    monthlyPayments: monthlyPayments ?? [],
    currentMonth,
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="monthly-payments-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
