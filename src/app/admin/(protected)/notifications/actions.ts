"use server";

import { createAdminServerClient } from "@/lib/supabase/admin-server";

export interface AdminNotification {
  id: string;
  type:
    | "student_note"
    | "ta_request_submitted"
    | "ta_request_resolved"
    | "waitlist_request_submitted"
    | "waitlist_seat_available"
    | "feedback_message_submitted";
  student_name: string | null;
  booking_code: string | null;
  grade_name: string | null;
  group_name: string | null;
  note_excerpt: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export async function getMyNotifications(): Promise<AdminNotification[]> {
  const supabase = await createAdminServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select(
      "id, type, student_name, booking_code, grade_name, group_name, note_excerpt, message, is_read, created_at"
    )
    .eq("recipient_admin_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const supabase = await createAdminServerClient();
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
}

export async function markAllNotificationsRead() {
  const supabase = await createAdminServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_admin_id", user.id)
    .eq("is_read", false);
}
