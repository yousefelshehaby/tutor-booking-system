"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { resolveWriteTutorId } from "@/lib/auth/resolve-write-tutor";

const gradeSchema = z.object({
  name: z.string().trim().min(1, "اسم الصف مطلوب"),
  display_order: z.coerce.number().int(),
  tutorId: z.string().optional(),
});

export async function createGrade(input: unknown): Promise<{ error: string } | { success: true }> {
  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const resolved = await resolveWriteTutorId(parsed.data.tutorId);
  if ("error" in resolved) return resolved;

  const supabase = await createAdminServerClient();
  const { error } = await supabase.from("grades").insert({
    name: parsed.data.name,
    display_order: parsed.data.display_order,
    tutor_id: resolved.tutorId,
  });
  if (error) return { error: "تعذر إضافة الصف الدراسي" };

  revalidatePath("/admin/grades");
  return { success: true };
}

export async function updateGrade(
  id: string,
  input: unknown
): Promise<{ error: string } | { success: true }> {
  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const resolved = await resolveWriteTutorId(parsed.data.tutorId);
  if ("error" in resolved) return resolved;

  const supabase = await createAdminServerClient();
  const { error } = await supabase
    .from("grades")
    .update({
      name: parsed.data.name,
      display_order: parsed.data.display_order,
      tutor_id: resolved.tutorId,
    })
    .eq("id", id);
  if (error) return { error: "تعذر تعديل الصف الدراسي" };

  revalidatePath("/admin/grades");
  return { success: true };
}

export async function toggleGradeActive(id: string, isActive: boolean) {
  const supabase = await createAdminServerClient();
  const { error } = await supabase.from("grades").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "تعذر تحديث حالة الصف الدراسي" };

  revalidatePath("/admin/grades");
  return { success: true };
}

export async function deleteGrade(id: string) {
  const supabase = await createAdminServerClient();
  const { error } = await supabase.from("grades").delete().eq("id", id);
  if (error) {
    return { error: "تعذر حذف الصف الدراسي، قد يكون له مجموعات أو حجوزات مرتبطة به" };
  }

  revalidatePath("/admin/grades");
  return { success: true };
}
