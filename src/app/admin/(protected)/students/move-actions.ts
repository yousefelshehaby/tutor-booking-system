"use server";

import { revalidatePath } from "next/cache";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import type { GroupWithAvailability } from "@/types/booking";

export async function getMoveTargetGroups(bookingId: string): Promise<GroupWithAvailability[]> {
  const supabase = await createAdminServerClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("tutor_id, grade_id, group_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return [];

  const { data, error } = await supabase.rpc("get_groups_with_availability", {
    p_tutor_id: booking.tutor_id,
    p_grade_id: booking.grade_id,
  });

  if (error || !data) return [];

  return (data as GroupWithAvailability[]).filter((g) => g.id !== booking.group_id);
}

const MOVE_ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHORIZED: "غير مصرح لك بهذا الإجراء",
  BOOKING_NOT_FOUND: "تعذر العثور على هذا الطالب",
  GROUP_NOT_FOUND: "المجموعة المختارة لم تعد متاحة",
  GRADE_MISMATCH: "لا يمكن النقل لمجموعة في صف دراسي مختلف",
  SAME_GROUP: "الطالب بالفعل في هذه المجموعة",
  GROUP_FULL: "للأسف المجموعة اكتملت، من فضلك اختر مجموعة أخرى",
};

export async function moveStudentToGroup(
  bookingId: string,
  newGroupId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createAdminServerClient();
  const { error } = await supabase.rpc("move_booking_to_group", {
    p_booking_id: bookingId,
    p_new_group_id: newGroupId,
  });

  if (error) {
    return { error: MOVE_ERROR_MESSAGES[error.message] ?? "تعذر نقل الطالب، من فضلك حاول مرة أخرى" };
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/waitlist");
  return { success: true };
}
