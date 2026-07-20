"use server";

import { revalidatePath } from "next/cache";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

export interface FeedbackMessageRow {
  id: string;
  sender_name: string | null;
  sender_phone: string | null;
  message_text: string;
  status: "new" | "read";
  created_at: string;
  tutor_name: string | null;
}

interface FeedbackJoinRow {
  id: string;
  sender_name: string | null;
  sender_phone: string | null;
  message_text: string;
  status: "new" | "read";
  created_at: string;
  tutors: { name: string } | { name: string }[] | null;
}

export async function getFeedbackMessages(): Promise<FeedbackMessageRow[]> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return [];

  const supabase = await createAdminServerClient();
  const { data, error } = await supabase
    .from("feedback_messages")
    .select("id, sender_name, sender_phone, message_text, status, created_at, tutors(name)")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as FeedbackJoinRow[]).map((row) => {
    const tutor = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return {
      id: row.id,
      sender_name: row.sender_name,
      sender_phone: row.sender_phone,
      message_text: row.message_text,
      status: row.status,
      created_at: row.created_at,
      tutor_name: tutor?.name ?? null,
    };
  });
}

export async function markFeedbackRead(id: string): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "غير مصرح لك بهذا الإجراء" };

  const supabase = await createAdminServerClient();
  const { error } = await supabase.from("feedback_messages").update({ status: "read" }).eq("id", id);

  if (error) return { error: "تعذر تحديث الحالة" };

  revalidatePath("/admin/feedback");
  return { success: true };
}

export async function deleteFeedbackMessage(id: string): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "غير مصرح لك بهذا الإجراء" };

  const supabase = await createAdminServerClient();
  const { error } = await supabase.from("feedback_messages").delete().eq("id", id);

  if (error) return { error: "تعذر حذف الرسالة" };

  revalidatePath("/admin/feedback");
  return { success: true };
}
