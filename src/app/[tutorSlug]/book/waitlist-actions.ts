"use server";

import { createAnonServerClient } from "@/lib/supabase/server";
import { checkBookingRateLimit, checkLookupRateLimit } from "@/lib/rate-limit/check";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit/message";
import { waitlistJoinSchema } from "@/lib/validation/booking";

export type JoinWaitlistResult =
  | { success: true; position: number; alreadyExisting: boolean }
  | { success: false; error: string };

const RPC_ERROR_MESSAGES: Record<string, string> = {
  TUTOR_NOT_FOUND: "حدث خطأ، من فضلك أعد تحميل الصفحة",
  GROUP_NOT_FOUND: "المجموعة التي اخترتها لم تعد متاحة، من فضلك أعد تحميل الصفحة",
  GROUP_GRADE_MISMATCH: "حدث خطأ في اختيار المجموعة، من فضلك ابدأ الحجز من جديد",
  GRADE_NOT_FOUND: "الصف الدراسي الذي اخترته لم يعد متاحًا، من فضلك ابدأ الحجز من جديد",
  GROUP_NOT_FULL: "توجد أماكن متاحة في هذه المجموعة الآن، من فضلك أعد تحميل الصفحة واحجز مباشرة",
};

export async function joinWaitlist(input: unknown): Promise<JoinWaitlistResult> {
  const parsed = waitlistJoinSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة" };
  }

  const { tutorId, gradeId, groupId, studentName, studentPhone, guardianPhone } = parsed.data;

  const allowed = await checkBookingRateLimit(studentPhone);
  if (!allowed) {
    return { success: false, error: RATE_LIMIT_MESSAGE };
  }

  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .rpc("join_waitlist", {
      p_tutor_id: tutorId,
      p_grade_id: gradeId,
      p_group_id: groupId,
      p_student_name: studentName,
      p_student_phone: studentPhone,
      p_guardian_phone: guardianPhone,
    })
    .single<{ id: string; position: number; already_existing: boolean }>();

  if (error || !data) {
    const message = error ? RPC_ERROR_MESSAGES[error.message] : undefined;
    return { success: false, error: message ?? "تعذر الانضمام لقائمة الانتظار، من فضلك حاول مرة أخرى" };
  }

  return { success: true, position: data.position, alreadyExisting: data.already_existing };
}

export interface WaitlistEntry {
  id: string;
  grade_name: string;
  group_name: string;
  position: number;
  created_at: string;
}

export async function findWaitlistEntry(params: {
  tutorId: string;
  phone: string;
}): Promise<WaitlistEntry | null> {
  // Shares the "lookup" bucket with findEligibleBookings/findActiveReservation
  // (all checked in sequence for one phone submit in PhoneFirstEntry), same
  // fail-closed-to-null shape as findActiveReservation since this return
  // type has no room for a distinct rate-limit message either.
  const allowed = await checkLookupRateLimit("lookup", params.phone);
  if (!allowed) return null;

  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .rpc("find_waitlist_entry", { p_tutor_id: params.tutorId, p_phone: params.phone })
    .maybeSingle<WaitlistEntry>();

  if (error || !data) {
    return null;
  }

  return data;
}
