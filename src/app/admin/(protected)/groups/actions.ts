"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { resolveWriteTutorId } from "@/lib/auth/resolve-write-tutor";

const groupSchema = z.object({
  grade_id: z.uuid("من فضلك اختر الصف الدراسي"),
  name: z.string().trim().min(1, "اسم المجموعة مطلوب"),
  days: z.string().trim().min(1, "الأيام مطلوبة"),
  time: z.string().trim().min(1, "الموعد مطلوب"),
  capacity: z.coerce.number().int().positive("السعة يجب أن تكون رقمًا موجبًا"),
  price: z.coerce.number().nonnegative("السعر يجب أن يكون رقمًا صحيحًا"),
  monthly_fee: z.coerce
    .number()
    .nonnegative("الاشتراك الشهري يجب أن يكون رقمًا صحيحًا")
    .nullable()
    .optional(),
  tutorId: z.string().optional(),
});

async function assertGradeBelongsToTutor(
  supabase: Awaited<ReturnType<typeof createAdminServerClient>>,
  gradeId: string,
  tutorId: string
): Promise<boolean> {
  const { data } = await supabase.from("grades").select("id").eq("id", gradeId).eq("tutor_id", tutorId).maybeSingle();
  return Boolean(data);
}

export async function createGroup(input: unknown): Promise<{ error: string } | { success: true }> {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const resolved = await resolveWriteTutorId(parsed.data.tutorId);
  if ("error" in resolved) return resolved;

  const supabase = await createAdminServerClient();

  if (!(await assertGradeBelongsToTutor(supabase, parsed.data.grade_id, resolved.tutorId))) {
    return { error: "الصف الدراسي المختار لا ينتمي لهذا المدرّس" };
  }

  const { grade_id, name, days, time, capacity, price, monthly_fee } = parsed.data;
  const { error } = await supabase
    .from("groups")
    .insert({ grade_id, name, days, time, capacity, price, monthly_fee, tutor_id: resolved.tutorId });
  if (error) return { error: "تعذر إضافة المجموعة" };

  revalidatePath("/admin/groups");
  return { success: true };
}

export async function updateGroup(
  id: string,
  input: unknown
): Promise<{ error: string } | { success: true }> {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const resolved = await resolveWriteTutorId(parsed.data.tutorId);
  if ("error" in resolved) return resolved;

  const supabase = await createAdminServerClient();

  if (!(await assertGradeBelongsToTutor(supabase, parsed.data.grade_id, resolved.tutorId))) {
    return { error: "الصف الدراسي المختار لا ينتمي لهذا المدرّس" };
  }

  const { grade_id, name, days, time, capacity, price, monthly_fee } = parsed.data;
  const { error } = await supabase
    .from("groups")
    .update({ grade_id, name, days, time, capacity, price, monthly_fee, tutor_id: resolved.tutorId })
    .eq("id", id);
  if (error) return { error: "تعذر تعديل المجموعة" };

  revalidatePath("/admin/groups");
  return { success: true };
}

export async function toggleGroupActive(id: string, isActive: boolean) {
  const supabase = await createAdminServerClient();
  const { error } = await supabase.from("groups").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "تعذر تحديث حالة المجموعة" };

  revalidatePath("/admin/groups");
  return { success: true };
}

export async function deleteGroup(id: string) {
  const supabase = await createAdminServerClient();
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) {
    return { error: "تعذر حذف المجموعة، قد يكون لها حجوزات مرتبطة بها" };
  }

  revalidatePath("/admin/groups");
  return { success: true };
}
