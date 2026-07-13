"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

const groupSchema = z.object({
  grade_id: z.uuid("من فضلك اختر الصف الدراسي"),
  name: z.string().trim().min(1, "اسم المجموعة مطلوب"),
  days: z.string().trim().min(1, "الأيام مطلوبة"),
  time: z.string().trim().min(1, "الموعد مطلوب"),
  capacity: z.coerce.number().int().positive("السعة يجب أن تكون رقمًا موجبًا"),
  price: z.coerce.number().nonnegative("السعر يجب أن يكون رقمًا صحيحًا"),
});

export async function createGroup(input: unknown) {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { tutorId } = await getCurrentAdmin();
  if (!tutorId) return { error: "هذا الحساب غير مرتبط بمدرّس" };

  const supabase = await createAdminServerClient();
  const { error } = await supabase.from("groups").insert({ ...parsed.data, tutor_id: tutorId });
  if (error) return { error: "تعذر إضافة المجموعة" };

  revalidatePath("/admin/groups");
  return { success: true };
}

export async function updateGroup(id: string, input: unknown) {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createAdminServerClient();
  const { error } = await supabase.from("groups").update(parsed.data).eq("id", id);
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
