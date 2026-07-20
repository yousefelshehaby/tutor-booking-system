"use server";

import { revalidatePath } from "next/cache";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

export interface WaitlistRow {
  id: string;
  student_name: string;
  student_phone: string;
  guardian_phone: string;
  grade_name: string;
  group_name: string;
  group_id: string;
  created_at: string;
}

interface WaitlistJoinRow {
  id: string;
  student_name: string;
  student_phone: string;
  guardian_phone: string;
  group_id: string;
  created_at: string;
  grades: { name: string } | { name: string }[] | null;
  groups: { name: string } | { name: string }[] | null;
}

export async function getWaitlistEntries(): Promise<WaitlistRow[]> {
  const { tutorId } = await getCurrentAdmin();
  if (!tutorId) return [];

  const supabase = await createAdminServerClient();
  const { data, error } = await supabase
    .from("waitlist_requests")
    .select(
      "id, student_name, student_phone, guardian_phone, created_at, group_id, grades(name), groups(name)"
    )
    .eq("tutor_id", tutorId)
    .eq("status", "waiting")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (data as WaitlistJoinRow[]).map((row) => {
    const grade = Array.isArray(row.grades) ? row.grades[0] : row.grades;
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    return {
      id: row.id,
      student_name: row.student_name,
      student_phone: row.student_phone,
      guardian_phone: row.guardian_phone,
      grade_name: grade?.name ?? "",
      group_name: group?.name ?? "",
      group_id: row.group_id,
      created_at: row.created_at,
    };
  });
}

const PROMOTE_ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHORIZED: "غير مصرح لك بهذا الإجراء",
  WAITLIST_ENTRY_NOT_FOUND: "تعذر العثور على الطلب",
  NOT_WAITING: "هذا الطلب لم يعد في قائمة الانتظار",
  GROUP_FULL: "المجموعة مكتملة العدد حاليًا، لا يوجد مكان لتحويله لحجز",
};

export async function promoteWaitlistEntry(
  id: string
): Promise<{ error: string } | { success: true; bookingCode: string }> {
  const { isTa } = await getCurrentAdmin();
  if (isTa) return { error: "غير مصرح لك بهذا الإجراء" };

  const supabase = await createAdminServerClient();
  const { data, error } = await supabase
    .rpc("promote_waitlist_entry", { p_waitlist_id: id })
    .single<{ id: string; booking_code: string }>();

  if (error || !data) {
    const message = error ? PROMOTE_ERROR_MESSAGES[error.message] : undefined;
    return { error: message ?? "تعذر تحويل الطلب لحجز" };
  }

  revalidatePath("/admin/waitlist");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/students");
  return { success: true, bookingCode: data.booking_code };
}

export async function removeWaitlistEntry(id: string): Promise<{ error: string } | { success: true }> {
  const { isTa } = await getCurrentAdmin();
  if (isTa) return { error: "غير مصرح لك بهذا الإجراء" };

  const supabase = await createAdminServerClient();
  const { error } = await supabase
    .from("waitlist_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "waiting");

  if (error) return { error: "تعذر إزالة الطلب" };

  revalidatePath("/admin/waitlist");
  return { success: true };
}
