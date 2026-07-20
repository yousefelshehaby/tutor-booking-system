"use server";

import { z } from "zod";
import { createAnonServerClient } from "@/lib/supabase/server";
import { checkFeedbackRateLimit } from "@/lib/rate-limit/check";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit/message";

const feedbackSchema = z.object({
  tutorId: z.uuid().nullable(),
  senderName: z.string().trim().max(200).optional(),
  senderPhone: z.string().trim().max(30).optional(),
  messageText: z
    .string()
    .trim()
    .min(1, "من فضلك اكتب رسالتك")
    .max(2000, "الرسالة طويلة جدًا، من فضلك اختصرها"),
});

export type SubmitFeedbackResult = { success: true } | { success: false; error: string };

export async function submitFeedback(input: unknown): Promise<SubmitFeedbackResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة" };
  }

  const allowed = await checkFeedbackRateLimit();
  if (!allowed) {
    return { success: false, error: RATE_LIMIT_MESSAGE };
  }

  const { tutorId, senderName, senderPhone, messageText } = parsed.data;

  const supabase = createAnonServerClient();
  const { error } = await supabase.rpc("submit_feedback_message", {
    p_tutor_id: tutorId,
    p_sender_name: senderName ?? null,
    p_sender_phone: senderPhone ?? null,
    p_message_text: messageText,
  });

  if (error) {
    return { success: false, error: "تعذر إرسال رسالتك، من فضلك حاول مرة أخرى" };
  }

  return { success: true };
}
