"use server";

import { z } from "zod";
import { createAnonServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { initiatePayment } from "@/lib/paymob/initiate-payment";
import { getTutorPaymobCredentials } from "@/lib/tutor/get-tutor-credentials";
import { phoneSchema } from "@/lib/validation/booking";
import { checkLookupRateLimit } from "@/lib/rate-limit/check";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit/message";
import type { PaymentMethod } from "@/types/booking";
import type { AccountStatementHeader, EligibleBooking, MonthlyPaymentStatus } from "@/types/monthly";

const lookupSchema = z
  .object({
    tutorId: z.uuid(),
    code: z.string().trim().optional(),
    phone: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.code) || Boolean(data.phone), {
    message: "من فضلك أدخل كود الحجز أو رقم الهاتف",
  })
  .refine((data) => !data.phone || phoneSchema.safeParse(data.phone).success, {
    message: "رقم الهاتف غير صحيح",
    path: ["phone"],
  });

export type FindBookingsResult =
  | { success: true; bookings: EligibleBooking[] }
  | { success: false; error: string };

export async function findEligibleBookings(input: unknown): Promise<FindBookingsResult> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const allowed = await checkLookupRateLimit("lookup", parsed.data.phone);
  if (!allowed) {
    return { success: false, error: RATE_LIMIT_MESSAGE };
  }

  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("find_eligible_bookings", {
    p_tutor_id: parsed.data.tutorId,
    p_code: parsed.data.code || null,
    p_phone: parsed.data.phone || null,
  });

  if (error) {
    return { success: false, error: "تعذر البحث عن الحجز، من فضلك حاول مرة أخرى" };
  }

  const bookings = (data ?? []) as EligibleBooking[];
  if (bookings.length === 0) {
    return {
      success: false,
      error: "لا يوجد حجز مؤكد الدفع مرتبط بهذه البيانات",
    };
  }

  return { success: true, bookings };
}

export async function getMonthlyStatus(bookingId: string): Promise<MonthlyPaymentStatus[]> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("get_monthly_payment_status", {
    p_booking_id: bookingId,
  });

  if (error) {
    throw new Error("تعذر تحميل حالة الاشتراك الشهري");
  }

  return (data ?? []) as MonthlyPaymentStatus[];
}

export async function getAccountStatementHeader(
  bookingId: string
): Promise<AccountStatementHeader | null> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .rpc("get_account_statement_header", { p_booking_id: bookingId })
    .single<AccountStatementHeader>();

  if (error || !data) {
    return null;
  }

  return data;
}

export type PayMonthResult =
  | { type: "redirect"; url: string }
  | { type: "fawry_reference"; billReference: string; month: string }
  | { type: "error"; message: string };

const RPC_ERROR_MESSAGES: Record<string, string> = {
  BOOKING_NOT_FOUND: "تعذر العثور على الحجز",
  BOOKING_NOT_ELIGIBLE: "هذا الحجز غير مؤهل للدفع الشهري",
  ALREADY_PAID: "هذا الشهر مدفوع بالفعل",
};

export async function payMonth(params: {
  tutorId: string;
  bookingId: string;
  month: string;
  paymentMethod: Exclude<PaymentMethod, "reserve_only">;
  studentName: string;
  studentPhone: string;
}): Promise<PayMonthResult> {
  const { tutorId, bookingId, month, paymentMethod, studentName, studentPhone } = params;

  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .rpc("pay_monthly_fee", {
      p_tutor_id: tutorId,
      p_booking_id: bookingId,
      p_month: month,
      p_payment_method: paymentMethod,
    })
    .single<{ id: string; amount: number; merchant_order_id: string }>();

  if (error || !data) {
    const message = error ? RPC_ERROR_MESSAGES[error.message] : undefined;
    return { type: "error", message: message ?? "تعذر بدء عملية الدفع، من فضلك حاول مرة أخرى" };
  }

  const credentials = await getTutorPaymobCredentials(tutorId);
  if (!credentials) {
    return { type: "error", message: "تعذر بدء عملية الدفع، من فضلك حاول مرة أخرى" };
  }

  try {
    const result = await initiatePayment({
      merchantOrderId: data.merchant_order_id,
      amount: data.amount,
      paymentMethod,
      studentName,
      studentPhone,
      credentials,
    });

    const serviceSupabase = createServiceClient();
    await serviceSupabase
      .from("monthly_payments")
      .update({ paymob_order_id: result.paymobOrderId })
      .eq("id", data.id);

    if (result.type === "redirect") {
      return { type: "redirect", url: result.url };
    }
    return { type: "fawry_reference", billReference: result.billReference, month };
  } catch {
    return { type: "error", message: "تعذر بدء عملية الدفع، من فضلك حاول مرة أخرى" };
  }
}
