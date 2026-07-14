"use server";

import { createAnonServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { initiatePayment } from "@/lib/paymob/initiate-payment";
import { getTutorPaymobCredentials } from "@/lib/tutor/get-tutor-credentials";
import { checkLookupRateLimit } from "@/lib/rate-limit/check";
import type { PaymentMethod } from "@/types/booking";

export interface ActiveReservation {
  booking_id: string;
  booking_code: string;
  student_name: string;
  payment_method: PaymentMethod;
  amount: number;
  expires_at: string | null;
  grade_name: string;
  group_name: string;
}

export async function findActiveReservation(params: {
  tutorId: string;
  phone: string;
}): Promise<ActiveReservation | null> {
  // Shares the "lookup" bucket with findEligibleBookings (the same phone
  // submit in PhoneFirstEntry always checks that one first) so this
  // rarely trips on its own — kept as its own check for defense in depth
  // rather than a hard error, since this action's return shape has no
  // room for a distinct rate-limit message.
  const allowed = await checkLookupRateLimit("lookup", params.phone);
  if (!allowed) return null;

  const supabase = createAnonServerClient();
  await supabase.rpc("expire_stale_reservations");

  const { data, error } = await supabase
    .rpc("find_active_reservation", { p_tutor_id: params.tutorId, p_phone: params.phone })
    .maybeSingle<ActiveReservation>();

  if (error || !data) {
    return null;
  }

  return data;
}

export type PayReservationResult =
  | { type: "redirect"; url: string }
  | { type: "fawry_reference"; billReference: string }
  | { type: "error"; message: string };

const RPC_ERROR_MESSAGES: Record<string, string> = {
  BOOKING_NOT_FOUND: "تعذر العثور على الحجز",
  RESERVATION_NOT_ELIGIBLE: "هذا الحجز غير مؤهل لإتمام الدفع",
  RESERVATION_EXPIRED: "انتهت مدة هذا الحجز، من فضلك احجز مكانًا جديدًا",
};

export async function payExistingReservation(params: {
  tutorId: string;
  bookingCode: string;
  paymentMethod: Exclude<PaymentMethod, "reserve_only">;
  studentName: string;
  studentPhone: string;
}): Promise<PayReservationResult> {
  const { tutorId, bookingCode, paymentMethod, studentName, studentPhone } = params;

  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .rpc("start_reservation_payment", {
      p_tutor_id: tutorId,
      p_booking_code: bookingCode,
      p_payment_method: paymentMethod,
    })
    .single<{ id: string; booking_code: string; amount: number }>();

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
      merchantOrderId: data.booking_code,
      amount: data.amount,
      paymentMethod,
      studentName,
      studentPhone,
      credentials,
    });

    const serviceSupabase = createServiceClient();
    await serviceSupabase
      .from("bookings")
      .update({ paymob_order_id: result.paymobOrderId })
      .eq("booking_code", data.booking_code);

    if (result.type === "redirect") {
      return { type: "redirect", url: result.url };
    }
    return { type: "fawry_reference", billReference: result.billReference };
  } catch {
    return { type: "error", message: "تعذر بدء عملية الدفع، من فضلك حاول مرة أخرى" };
  }
}
