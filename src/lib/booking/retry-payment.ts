"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { initiatePayment } from "@/lib/paymob/initiate-payment";
import { getTutorPaymobCredentials } from "@/lib/tutor/get-tutor-credentials";
import type { PaymentMethod } from "@/types/booking";

export type RetryPaymentResult =
  | { type: "redirect"; url: string }
  | { type: "fawry_reference"; billReference: string }
  | { type: "error"; message: string };

export async function retryPayment(bookingCode: string): Promise<RetryPaymentResult> {
  const supabase = createServiceClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "booking_code, student_name, student_phone, amount, payment_method, payment_status, tutor_id"
    )
    .eq("booking_code", bookingCode)
    .single();

  if (error || !booking) {
    return { type: "error", message: "لم يتم العثور على الحجز" };
  }

  if (booking.payment_status !== "pending") {
    return { type: "error", message: "لا يمكن إعادة الدفع لهذا الحجز" };
  }

  if (booking.payment_method === "reserve_only") {
    return { type: "error", message: "هذا الحجز لا يتطلب دفع إلكتروني" };
  }

  const credentials = await getTutorPaymobCredentials(booking.tutor_id);
  if (!credentials) {
    return { type: "error", message: "تعذر بدء عملية الدفع، من فضلك حاول مرة أخرى" };
  }

  try {
    const result = await initiatePayment({
      bookingCode: booking.booking_code,
      amount: Number(booking.amount),
      paymentMethod: booking.payment_method as Exclude<PaymentMethod, "reserve_only">,
      studentName: booking.student_name,
      studentPhone: booking.student_phone,
      credentials,
    });

    if (result.type === "redirect") {
      return { type: "redirect", url: result.url };
    }
    return { type: "fawry_reference", billReference: result.billReference };
  } catch {
    return { type: "error", message: "تعذر بدء عملية الدفع، من فضلك حاول مرة أخرى" };
  }
}
