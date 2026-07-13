"use server";

import { revalidatePath } from "next/cache";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

export async function markMonthlyPaymentPaid(params: {
  monthlyPaymentId: string | null;
  bookingId: string;
  month: string;
  amount: number;
}) {
  const supabase = await createAdminServerClient();

  if (params.monthlyPaymentId) {
    const { error } = await supabase
      .from("monthly_payments")
      .update({ payment_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", params.monthlyPaymentId);

    if (error) return { error: "تعذر تحديث حالة الدفع" };
  } else {
    const { tutorId } = await getCurrentAdmin();
    if (!tutorId) return { error: "هذا الحساب غير مرتبط بمدرّس" };

    const { error } = await supabase.from("monthly_payments").insert({
      booking_id: params.bookingId,
      tutor_id: tutorId,
      month: params.month,
      amount: params.amount,
      payment_method: "reserve_only",
      payment_status: "paid",
      paid_at: new Date().toISOString(),
    });

    if (error) return { error: "تعذر تسجيل الدفع" };
  }

  revalidatePath("/admin/monthly-payments");
  return { success: true };
}
