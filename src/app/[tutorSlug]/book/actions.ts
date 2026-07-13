"use server";

import { createAnonServerClient } from "@/lib/supabase/server";
import { initiatePayment } from "@/lib/paymob/initiate-payment";
import { getTutorPaymobCredentials } from "@/lib/tutor/get-tutor-credentials";
import { bookingSubmitSchema } from "@/lib/validation/booking";
import type { Grade, GroupWithAvailability } from "@/types/booking";

export async function getActiveGrades(tutorId: string): Promise<Grade[]> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .from("grades")
    .select("id, name, display_order, is_active")
    .eq("tutor_id", tutorId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error("تعذر تحميل الصفوف الدراسية، من فضلك حاول مرة أخرى");
  }

  return data ?? [];
}

export async function getGroupsForGrade(
  tutorId: string,
  gradeId: string
): Promise<GroupWithAvailability[]> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("get_groups_with_availability", {
    p_tutor_id: tutorId,
    p_grade_id: gradeId,
  });

  if (error) {
    throw new Error("تعذر تحميل المجموعات، من فضلك حاول مرة أخرى");
  }

  return data ?? [];
}

export type SubmitBookingResult =
  | { success: true; bookingCode: string; nextAction: "redirect"; paymentUrl: string }
  | { success: true; bookingCode: string; nextAction: "fawry_reference"; billReference: string }
  | { success: true; bookingCode: string; nextAction: "success_page" }
  | { success: false; error: string };

const RPC_ERROR_MESSAGES: Record<string, string> = {
  TUTOR_NOT_FOUND: "حدث خطأ، من فضلك أعد تحميل الصفحة",
  GROUP_NOT_FOUND: "المجموعة التي اخترتها لم تعد متاحة، من فضلك اختر مجموعة أخرى",
  GROUP_GRADE_MISMATCH: "حدث خطأ في اختيار المجموعة، من فضلك ابدأ الحجز من جديد",
  GRADE_NOT_FOUND: "الصف الدراسي الذي اخترته لم يعد متاحًا، من فضلك ابدأ الحجز من جديد",
  GROUP_FULL: "للأسف المجموعة اكتملت، من فضلك اختر مجموعة أخرى",
};

export async function submitBooking(input: unknown): Promise<SubmitBookingResult> {
  const parsed = bookingSubmitSchema.safeParse(input);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { success: false, error: firstIssue?.message ?? "البيانات المدخلة غير صحيحة" };
  }

  const { tutorId, studentName, studentPhone, guardianPhone, gradeId, groupId, paymentMethod } =
    parsed.data;

  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .rpc("create_booking", {
      p_tutor_id: tutorId,
      p_student_name: studentName,
      p_student_phone: studentPhone,
      p_guardian_phone: guardianPhone,
      p_grade_id: gradeId,
      p_group_id: groupId,
      p_payment_method: paymentMethod,
    })
    .single<{
      id: string;
      booking_code: string;
      amount: number;
      expires_at: string | null;
      tutor_id: string;
    }>();

  if (error || !data) {
    const message = error ? RPC_ERROR_MESSAGES[error.message] : undefined;
    return { success: false, error: message ?? "تعذر إتمام الحجز، من فضلك حاول مرة أخرى" };
  }

  if (paymentMethod === "reserve_only") {
    return { success: true, bookingCode: data.booking_code, nextAction: "success_page" };
  }

  try {
    const credentials = await getTutorPaymobCredentials(data.tutor_id);
    if (!credentials) {
      throw new Error("Tutor has no Paymob credentials configured");
    }

    const result = await initiatePayment({
      bookingCode: data.booking_code,
      amount: data.amount,
      paymentMethod,
      studentName,
      studentPhone,
      credentials,
    });

    if (result.type === "redirect") {
      return {
        success: true,
        bookingCode: data.booking_code,
        nextAction: "redirect",
        paymentUrl: result.url,
      };
    }

    return {
      success: true,
      bookingCode: data.booking_code,
      nextAction: "fawry_reference",
      billReference: result.billReference,
    };
  } catch {
    // Booking already exists as "pending" — send the student to the booking
    // page where they can retry payment instead of losing their seat.
    return { success: true, bookingCode: data.booking_code, nextAction: "success_page" };
  }
}
