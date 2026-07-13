"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

const createTaSchema = z.object({
  name: z.string().trim().min(1, "اسم المساعد مطلوب"),
  email: z.email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف"),
  tutorIds: z.array(z.uuid()).min(1, "من فضلك اختر مدرّس واحد على الأقل"),
});

export async function createTa(input: unknown): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const parsed = createTaSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const { name, email, password, tutorIds } = parsed.data;
  const service = createServiceClient();

  const { data: tutors } = await service.from("tutors").select("id").in("id", tutorIds);
  if (!tutors || tutors.length !== tutorIds.length) {
    return { error: "أحد المدرّسين المختارين غير موجود" };
  }

  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    return { error: "تعذر إنشاء الحساب (قد يكون البريد مستخدم بالفعل)" };
  }

  const { error: adminUserError } = await service.from("admin_users").insert({
    id: authUser.user.id,
    tutor_id: tutorIds[0],
    role: "ta",
    email,
    name,
  });

  if (adminUserError) {
    await service.auth.admin.deleteUser(authUser.user.id);
    return { error: "تعذر إنشاء حساب المساعد" };
  }

  const { error: linksError } = await service
    .from("ta_tutor_links")
    .insert(tutorIds.map((tutorId) => ({ ta_id: authUser.user.id, tutor_id: tutorId })));

  if (linksError) {
    await service.from("admin_users").delete().eq("id", authUser.user.id);
    await service.auth.admin.deleteUser(authUser.user.id);
    return { error: "تعذر ربط المساعد بالمدرّسين المختارين" };
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

export async function updateTaTutorLinks(
  taId: string,
  tutorIds: string[]
): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  if (tutorIds.length === 0) {
    return { error: "لازم يبقى المساعد مرتبط بمدرّس واحد على الأقل" };
  }

  const service = createServiceClient();

  const { data: tutors } = await service.from("tutors").select("id").in("id", tutorIds);
  if (!tutors || tutors.length !== tutorIds.length) {
    return { error: "أحد المدرّسين المختارين غير موجود" };
  }

  const { error: deleteError } = await service.from("ta_tutor_links").delete().eq("ta_id", taId);
  if (deleteError) return { error: "تعذر تحديث ربط المدرّسين" };

  const { error: insertError } = await service
    .from("ta_tutor_links")
    .insert(tutorIds.map((tutorId) => ({ ta_id: taId, tutor_id: tutorId })));
  if (insertError) return { error: "تعذر تحديث ربط المدرّسين" };

  // If the TA's currently-active tutor was removed from the set, fall back
  // to the first remaining one so they're never left pointing at a tutor
  // they no longer have access to.
  const { data: adminUser } = await service.from("admin_users").select("tutor_id").eq("id", taId).single();
  if (adminUser && !tutorIds.includes(adminUser.tutor_id)) {
    await service.from("admin_users").update({ tutor_id: tutorIds[0] }).eq("id", taId);
  }

  revalidatePath("/admin/tas");
  return { success: true };
}

export async function switchTaTutor(tutorId: string): Promise<{ error: string } | { success: true }> {
  const { isTa } = await getCurrentAdmin();
  if (!isTa) return { error: "هذا الإجراء متاح فقط للمساعدين" };

  const supabase = await createAdminServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الجلسة منتهية" };

  const { error } = await supabase.from("admin_users").update({ tutor_id: tutorId }).eq("id", user.id);
  if (error) return { error: "تعذر التحويل لهذا المدرّس" };

  revalidatePath("/admin/bookings");
  return { success: true };
}
