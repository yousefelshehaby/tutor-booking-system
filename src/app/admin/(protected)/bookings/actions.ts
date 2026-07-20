"use server";

import { revalidatePath } from "next/cache";
import { createAdminServerClient } from "@/lib/supabase/admin-server";

export async function markBookingPaid(id: string) {
  const supabase = await createAdminServerClient();
  const { error } = await supabase
    .from("bookings")
    .update({ payment_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "تعذر تحديث حالة الحجز" };

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/students");
  return { success: true };
}

export async function cancelBooking(id: string) {
  const supabase = await createAdminServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ payment_status: "cancelled" })
    .eq("id", id)
    .select("group_id")
    .maybeSingle();

  if (error) return { error: "تعذر إلغاء الحجز" };

  if (data?.group_id) {
    await supabase.rpc("notify_waitlist_seat_freed", { p_group_id: data.group_id });
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/students");
  return { success: true };
}

export async function archiveBooking(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createAdminServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الجلسة منتهية" };

  const { data, error } = await supabase
    .from("bookings")
    .update({ archived_at: new Date().toISOString(), archived_by: user.id })
    .eq("id", id)
    .is("archived_at", null)
    .select("group_id")
    .maybeSingle();

  if (error) return { error: "تعذر حذف الطالب" };

  if (data?.group_id) {
    await supabase.rpc("notify_waitlist_seat_freed", { p_group_id: data.group_id });
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/students");
  return { success: true };
}

const RESTORE_ERROR_MESSAGES: Record<string, string> = {
  GROUP_FULL: "لا يمكن الاستعادة، المجموعة مكتملة العدد حاليًا",
  NOT_ARCHIVED: "هذا الطالب غير محذوف أصلًا",
  BOOKING_NOT_FOUND: "تعذر العثور على الحجز",
  NOT_AUTHORIZED: "غير مصرح لك بهذا الإجراء",
};

export async function restoreBooking(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createAdminServerClient();
  const { error } = await supabase.rpc("restore_booking", { p_booking_id: id });

  if (error) {
    return { error: RESTORE_ERROR_MESSAGES[error.message] ?? "تعذر استعادة الطالب" };
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/students");
  return { success: true };
}

export interface StudentNote {
  id: string;
  note: string;
  created_at: string;
  author_email: string | null;
}

export async function getNotesForBooking(bookingId: string): Promise<StudentNote[]> {
  const supabase = await createAdminServerClient();
  const { data, error } = await supabase
    .from("student_notes")
    .select("id, note, created_at, admin_users(email)")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const author = Array.isArray(row.admin_users) ? row.admin_users[0] : row.admin_users;
    return {
      id: row.id,
      note: row.note,
      created_at: row.created_at,
      author_email: author?.email ?? null,
    };
  });
}

export async function addStudentNote(tutorId: string, bookingId: string, note: string) {
  if (!note.trim()) return { error: "من فضلك اكتب ملاحظة" };

  const supabase = await createAdminServerClient();
  const { error } = await supabase.rpc("create_student_note", {
    p_tutor_id: tutorId,
    p_booking_id: bookingId,
    p_note: note.trim(),
  });

  if (error) return { error: "تعذر إضافة الملاحظة" };

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/students");
  return { success: true };
}
