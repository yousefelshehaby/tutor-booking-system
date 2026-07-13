"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

const settingsSchema = z.object({
  booking_open: z.boolean(),
  monthly_payment_open: z.boolean(),
  current_month: z.string().regex(/^\d{4}-\d{2}$/, "صيغة الشهر يجب أن تكون YYYY-MM"),
});

export async function updateSettings(input: unknown) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { tutorId } = await getCurrentAdmin();
  if (!tutorId) return { error: "هذا الحساب غير مرتبط بمدرّس" };

  const supabase = await createAdminServerClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ tutor_id: tutorId, ...parsed.data });

  if (error) return { error: "تعذر حفظ الإعدادات" };

  revalidatePath("/admin/settings");
  return { success: true };
}
