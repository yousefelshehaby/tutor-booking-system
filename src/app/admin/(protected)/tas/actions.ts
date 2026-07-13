"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

const createTaSchema = z.object({
  email: z.email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف"),
  tutorId: z.uuid("من فضلك اختر المدرّس"),
});

export async function createTa(input: unknown): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const parsed = createTaSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const service = createServiceClient();

  const { data: tutor } = await service.from("tutors").select("id").eq("id", parsed.data.tutorId).maybeSingle();
  if (!tutor) return { error: "المدرّس المختار غير موجود" };

  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    return { error: "تعذر إنشاء الحساب (قد يكون البريد مستخدم بالفعل)" };
  }

  const { error: adminUserError } = await service.from("admin_users").insert({
    id: authUser.user.id,
    tutor_id: parsed.data.tutorId,
    role: "ta",
    email: parsed.data.email,
  });

  if (adminUserError) {
    await service.auth.admin.deleteUser(authUser.user.id);
    return { error: "تعذر إنشاء حساب المساعد" };
  }

  revalidatePath("/admin/tas");
  return { success: true };
}

export async function setTaActive(
  taId: string,
  isActive: boolean
): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin, role } = await getCurrentAdmin();
  if (!(isSuperAdmin || role === "tutor")) return { error: "غير مصرح" };

  const supabase = await createAdminServerClient();
  const { error } = await supabase
    .from("admin_users")
    .update({ is_active: isActive })
    .eq("id", taId)
    .eq("role", "ta");

  if (error) return { error: "تعذر تحديث حالة المساعد" };

  revalidatePath("/admin/tas");
  return { success: true };
}
