"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
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

export async function createTutor(input: unknown): Promise<{ error: string } | { success: true }> {
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

export async function toggleTutorActive(
  tutorId: string,
  isActive: boolean
): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const service = createServiceClient();
  const { error } = await service.from("tutors").update({ is_active: isActive }).eq("id", tutorId);
  if (error) return { error: "تعذر تحديث حالة المدرّس" };

  revalidatePath("/admin/tutors");
  return { success: true };
}

export async function resetAdminPassword(
  adminUserId: string,
  newPassword: string
): Promise<{ error: string } | { success: true }> {
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

function generateStrongPassword(): string {
  return randomBytes(12).toString("base64url");
}

export async function generateTutorPassword(
  tutorId: string
): Promise<{ error: string } | { success: true; password: string }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const service = createServiceClient();
  const { data: adminUser, error: findError } = await service
    .from("admin_users")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("role", "tutor")
    .single();

  if (findError || !adminUser) {
    return { error: "تعذر العثور على حساب دخول هذا المدرّس" };
  }

  const password = generateStrongPassword();
  const { error } = await service.auth.admin.updateUserById(adminUser.id, { password });

  if (error) return { error: "تعذر تغيير كلمة المرور" };
  return { success: true, password };
}

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "اسم المدرّس مطلوب"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط"),
  phone: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  bankAccountHolder: z.string().trim().optional(),
  bankAccountNumber: z.string().trim().optional(),
});

export async function updateTutorProfile(
  tutorId: string,
  input: unknown
): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { name, slug, phone, bankName, bankAccountHolder, bankAccountNumber } = parsed.data;
  const service = createServiceClient();

  const { error } = await service
    .from("tutors")
    .update({
      name,
      slug,
      phone: phone || null,
      bank_name: bankName || null,
      bank_account_holder: bankAccountHolder || null,
      bank_account_number: bankAccountNumber || null,
    })
    .eq("id", tutorId);

  if (error) {
    return { error: error.code === "23505" ? "هذا الرابط مستخدم بالفعل" : "تعذر حفظ البيانات" };
  }

  revalidatePath(`/admin/tutors/${tutorId}`);
  revalidatePath("/admin/tutors");
  return { success: true };
}

export async function updateTutorEmail(
  tutorId: string,
  newEmail: string
): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const parsedEmail = z.email("البريد الإلكتروني غير صحيح").safeParse(newEmail);
  if (!parsedEmail.success) return { error: parsedEmail.error.issues[0]?.message ?? "بريد غير صحيح" };

  const service = createServiceClient();
  const { data: adminUser, error: findError } = await service
    .from("admin_users")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("role", "tutor")
    .single();

  if (findError || !adminUser) {
    return { error: "تعذر العثور على حساب دخول هذا المدرّس" };
  }

  const { error: authError } = await service.auth.admin.updateUserById(adminUser.id, {
    email: parsedEmail.data,
    email_confirm: true,
  });

  if (authError) {
    return { error: "تعذر تغيير البريد الإلكتروني (قد يكون مستخدمًا بالفعل)" };
  }

  await service.from("admin_users").update({ email: parsedEmail.data }).eq("id", adminUser.id);

  revalidatePath(`/admin/tutors/${tutorId}`);
  return { success: true };
}

export async function uploadTutorPhoto(
  tutorId: string,
  formData: FormData
): Promise<{ error: string } | { success: true; photoUrl: string }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "من فضلك اختر صورة" };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "الملف المختار ليس صورة" };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "حجم الصورة يجب ألا يزيد عن 5 ميجابايت" };
  }

  const service = createServiceClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${tutorId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await service.storage
    .from("tutor-photos")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return { error: "تعذر رفع الصورة" };
  }

  const {
    data: { publicUrl },
  } = service.storage.from("tutor-photos").getPublicUrl(path);

  const { error: updateError } = await service
    .from("tutors")
    .update({ photo_url: publicUrl })
    .eq("id", tutorId);

  if (updateError) {
    return { error: "تعذر حفظ رابط الصورة" };
  }

  revalidatePath(`/admin/tutors/${tutorId}`);
  revalidatePath("/admin/tutors");
  revalidatePath("/");
  return { success: true, photoUrl: publicUrl };
}

const paymobCredentialsSchema = z.object({
  paymobApiKey: z.string().trim().min(1, "API key مطلوب"),
  paymobHmacSecret: z.string().trim().min(1, "HMAC secret مطلوب"),
  paymobCardIntegrationId: z.string().trim().optional(),
  paymobWalletIntegrationId: z.string().trim().optional(),
  paymobFawryIntegrationId: z.string().trim().optional(),
  paymobIframeId: z.string().trim().min(1, "Iframe ID مطلوب — من غيره الدفع بالبطاقة مش هيشتغل"),
});

export async function updateTutorPaymobCredentials(
  tutorId: string,
  input: unknown
): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const parsed = paymobCredentialsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const {
    paymobApiKey,
    paymobHmacSecret,
    paymobCardIntegrationId,
    paymobWalletIntegrationId,
    paymobFawryIntegrationId,
    paymobIframeId,
  } = parsed.data;

  const service = createServiceClient();
  const { error } = await service
    .from("tutors")
    .update({
      paymob_api_key: paymobApiKey,
      paymob_hmac_secret: paymobHmacSecret,
      paymob_card_integration_id: paymobCardIntegrationId || null,
      paymob_wallet_integration_id: paymobWalletIntegrationId || null,
      paymob_fawry_integration_id: paymobFawryIntegrationId || null,
      paymob_iframe_id: paymobIframeId,
    })
    .eq("id", tutorId);

  if (error) {
    return { error: "تعذر حفظ بيانات Paymob" };
  }

  revalidatePath(`/admin/tutors/${tutorId}`);
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
