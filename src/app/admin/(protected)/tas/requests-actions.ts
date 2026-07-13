"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { createTaAccount, type CreateTaAccountInput } from "@/app/admin/(protected)/tas/actions";

const createRequestSchema = z.object({
  taName: z.string().trim().min(1, "اسم المساعد مطلوب"),
  taEmail: z.email("البريد الإلكتروني غير صحيح"),
  taPhone: z.string().trim().optional(),
  tutorNote: z.string().trim().optional(),
});

export async function createTaRequest(input: unknown): Promise<{ error: string } | { success: true }> {
  const { role, tutorId } = await getCurrentAdmin();
  if (role !== "tutor" || !tutorId) return { error: "هذا الإجراء متاح فقط للمدرّس" };

  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const service = createServiceClient();

  const { data: existing } = await service
    .from("ta_requests")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("ta_email", parsed.data.taEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { error: "يوجد بالفعل طلب معلّق بنفس البريد الإلكتروني" };
  }

  const { data: tutor } = await service.from("tutors").select("name").eq("id", tutorId).maybeSingle();

  const { data: request, error } = await service
    .from("ta_requests")
    .insert({
      tutor_id: tutorId,
      ta_name: parsed.data.taName,
      ta_email: parsed.data.taEmail,
      ta_phone: parsed.data.taPhone || null,
      tutor_note: parsed.data.tutorNote || null,
    })
    .select("id")
    .single();

  if (error || !request) {
    return { error: "تعذر إرسال الطلب" };
  }

  const { data: superAdmins } = await service
    .from("admin_users")
    .select("id")
    .eq("role", "super_admin")
    .eq("is_active", true);

  if (superAdmins && superAdmins.length > 0) {
    await service.from("notifications").insert(
      superAdmins.map((admin) => ({
        tutor_id: tutorId,
        recipient_admin_id: admin.id,
        type: "ta_request_submitted",
        ta_request_id: request.id,
        message: `طلب مساعد جديد من ${tutor?.name ?? "مدرّس"}: ${parsed.data.taName}`,
      }))
    );
  }

  revalidatePath("/admin/tas");
  return { success: true };
}

async function notifyTutorOfResolution(
  service: ReturnType<typeof createServiceClient>,
  tutorId: string,
  taName: string,
  approved: boolean,
  adminNote?: string
) {
  const { data: tutorAdmins } = await service
    .from("admin_users")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("role", "tutor");

  if (!tutorAdmins || tutorAdmins.length === 0) return;

  const message = approved
    ? `تمت الموافقة على طلب إضافة المساعد ${taName}`
    : `تم رفض طلب إضافة المساعد ${taName}${adminNote ? `: ${adminNote}` : ""}`;

  await service.from("notifications").insert(
    tutorAdmins.map((admin) => ({
      tutor_id: tutorId,
      recipient_admin_id: admin.id,
      type: "ta_request_resolved",
      message,
    }))
  );
}

export async function rejectTaRequest(
  requestId: string,
  adminNote?: string
): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const service = createServiceClient();
  const { data: request } = await service
    .from("ta_requests")
    .select("tutor_id, ta_name, status")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "تعذر العثور على الطلب" };
  if (request.status !== "pending") return { error: "تم التعامل مع هذا الطلب بالفعل" };

  const { error } = await service
    .from("ta_requests")
    .update({ status: "rejected", admin_note: adminNote || null, resolved_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { error: "تعذر رفض الطلب" };

  await notifyTutorOfResolution(service, request.tutor_id, request.ta_name, false, adminNote);

  revalidatePath("/admin/tas");
  return { success: true };
}

export async function approveTaRequest(
  requestId: string,
  input: CreateTaAccountInput
): Promise<{ error: string } | { success: true }> {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) return { error: "هذا الإجراء متاح فقط لمدير النظام" };

  const service = createServiceClient();
  const { data: request } = await service
    .from("ta_requests")
    .select("tutor_id, ta_name, status")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "تعذر العثور على الطلب" };
  if (request.status !== "pending") return { error: "تم التعامل مع هذا الطلب بالفعل" };

  const result = await createTaAccount(input);
  if ("error" in result) return result;

  await service
    .from("ta_requests")
    .update({ status: "approved", resolved_at: new Date().toISOString() })
    .eq("id", requestId);

  await notifyTutorOfResolution(service, request.tutor_id, request.ta_name, true);

  revalidatePath("/admin/tas");
  return { success: true };
}
