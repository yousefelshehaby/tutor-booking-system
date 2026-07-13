"use server";

import { createAdminServerClient } from "@/lib/supabase/admin-server";

export interface AdminNotification {
  id: string;
  student_name: string;
  booking_code: string;
  grade_name: string;
  group_name: string;
  note_excerpt: string | null;
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
    .select("id, student_name, booking_code, grade_name, group_name, note_excerpt, is_read, created_at")
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
