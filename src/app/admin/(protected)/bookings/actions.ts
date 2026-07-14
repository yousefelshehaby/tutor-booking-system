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
  const { error } = await supabase.from("bookings").update({ payment_status: "cancelled" }).eq("id", id);

  if (error) return { error: "تعذر إلغاء الحجز" };

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
