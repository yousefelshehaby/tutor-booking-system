"use server";

import { createAnonServerClient } from "@/lib/supabase/server";
import { phoneSchema } from "@/lib/validation/booking";
import { formatMonth } from "@/lib/utils/format-month";
import { checkLookupRateLimit } from "@/lib/rate-limit/check";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit/message";

export interface StudentTutorBooking {
  booking_id: string;
  tutor_id: string;
  tutor_name: string;
  tutor_slug: string;
  tutor_photo_url: string | null;
  grade_name: string;
  group_name: string;
  group_days: string;
  group_time: string;
  payment_status: "pending" | "paid" | "expired" | "cancelled";
  booking_code: string;
  created_at: string;
  monthlySummary: string;
}

export interface RecentActivityItem {
  event_type: "booking_created" | "booking_paid" | "monthly_paid";
  event_date: string;
  tutor_name: string;
  description: string;
}

export type StudentActivityResult =
  | { success: true; bookings: StudentTutorBooking[]; activity: RecentActivityItem[] }
  | { success: false; error: string };

interface MonthlyStatusRow {
  month: string;
  is_paid: boolean;
}

async function computeMonthlySummary(
  supabase: ReturnType<typeof createAnonServerClient>,
  bookingId: string
): Promise<string> {
  const { data } = await supabase.rpc("get_monthly_payment_status", { p_booking_id: bookingId });
  const months = (data ?? []) as MonthlyStatusRow[];

  if (months.length === 0) return "";

  const unpaid = months.filter((m) => !m.is_paid);
  if (unpaid.length === 0) {
    const latest = months[months.length - 1];
    return `مدفوع حتى شهر ${formatMonth(latest.month)}`;
  }

  return `متأخر: ${unpaid.map((m) => formatMonth(m.month)).join(" و")}`;
}

export async function getStudentActivity(phone: string): Promise<StudentActivityResult> {
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "رقم الهاتف غير صحيح" };
  }

  const allowed = await checkLookupRateLimit("myaccount", parsed.data);
  if (!allowed) {
    return { success: false, error: RATE_LIMIT_MESSAGE };
  }

  const supabase = createAnonServerClient();

  const [{ data: bookingRows, error: bookingsError }, { data: activityRows }] = await Promise.all([
    supabase.rpc("find_student_bookings_across_tutors", { p_phone: parsed.data }),
    supabase.rpc("get_student_recent_activity", { p_phone: parsed.data }),
  ]);

  if (bookingsError) {
    return { success: false, error: "تعذر تحميل البيانات، من فضلك حاول مرة أخرى" };
  }

  const rows = (bookingRows ?? []) as Omit<StudentTutorBooking, "monthlySummary">[];

  const bookings: StudentTutorBooking[] = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      monthlySummary: row.payment_status === "paid" ? await computeMonthlySummary(supabase, row.booking_id) : "",
    }))
  );

  if (bookings.length === 0) {
    return { success: false, error: "لا يوجد أي بيانات مرتبطة بهذا الرقم" };
  }

  return {
    success: true,
    bookings,
    activity: (activityRows ?? []) as RecentActivityItem[],
  };
}
