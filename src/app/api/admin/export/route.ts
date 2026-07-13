import { NextResponse } from "next/server";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { buildBookingsWorkbook } from "@/lib/excel/build-workbook";

export async function GET() {
  const supabase = await createAdminServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 401 });
  }

  await supabase.rpc("expire_stale_reservations");

  const [{ data: grades }, { data: groups }, { data: bookings }] = await Promise.all([
    supabase.from("grades").select("id, name, display_order"),
    supabase.from("groups").select("id, grade_id, name, days, time"),
    supabase
      .from("bookings")
      .select(
        "booking_code, student_name, student_phone, guardian_phone, payment_method, payment_status, amount, created_at, group_id"
      ),
  ]);

  const buffer = await buildBookingsWorkbook({
    grades: grades ?? [],
    groups: groups ?? [],
    bookings: bookings ?? [],
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
