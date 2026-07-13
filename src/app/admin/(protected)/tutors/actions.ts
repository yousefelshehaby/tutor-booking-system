"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

const createTutorSchema = z.object({
  name: z.string().trim().min(1, "اسم المدرّس مطلوب"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط"),
  phone: z.string().trim().optional(),
  adminEmail: z.email("البريد الإلكتروني غير صحيح"),
  adminPassword: z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف"),
});

export async function createTutor(input: unknown) {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const parsed = createTutorSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { name, slug, phone, adminEmail, adminPassword } = parsed.data;
  const service = createServiceClient();

  const { data: tutor, error: tutorError } = await service
    .from("tutors")
    .insert({ name, slug, phone: phone || null })
    .select("id")
    .single();

  if (tutorError || !tutor) {
    return {
      error: tutorError?.code === "23505" ? "هذا الرابط مستخدم بالفعل" : "تعذر إنشاء المدرّس",
    };
  }

  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    await service.from("tutors").delete().eq("id", tutor.id);
    return { error: "تعذر إنشاء حساب الدخول لهذا المدرّس (قد يكون البريد مستخدم بالفعل)" };
  }

  const { error: adminUserError } = await service.from("admin_users").insert({
    id: authUser.user.id,
    tutor_id: tutor.id,
    role: "tutor",
    email: adminEmail,
  });

  if (adminUserError) {
    await service.auth.admin.deleteUser(authUser.user.id);
    await service.from("tutors").delete().eq("id", tutor.id);
    return { error: "تعذر ربط حساب الدخول بالمدرّس" };
  }

  await service.from("settings").insert({ tutor_id: tutor.id });

  revalidatePath("/admin/tutors");
  return { success: true };
}

export async function toggleTutorActive(tutorId: string, isActive: boolean) {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const service = createServiceClient();
  const { error } = await service.from("tutors").update({ is_active: isActive }).eq("id", tutorId);
  if (error) return { error: "تعذر تحديث حالة المدرّس" };

  revalidatePath("/admin/tutors");
  return { success: true };
}

export async function resetAdminPassword(adminUserId: string, newPassword: string) {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  if (newPassword.length < 8) return { error: "كلمة المرور يجب ألا تقل عن 8 أحرف" };

  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(adminUserId, {
    password: newPassword,
  });

  if (error) return { error: "تعذر تغيير كلمة المرور" };
  return { success: true };
}

export async function switchActiveTutor(tutorId: string) {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const supabase = await createAdminServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الجلسة منتهية" };

  const { error } = await supabase
    .from("admin_users")
    .update({ tutor_id: tutorId })
    .eq("id", user.id);

  if (error) return { error: "تعذر التحويل لهذا المدرّس" };

  redirect("/admin/dashboard");
}
