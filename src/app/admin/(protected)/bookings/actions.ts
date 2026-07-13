"use server";

import { revalidatePath } from "next/cache";
import { createAdminServerClient } from "@/lib/supabase/admin-server";

export async function markBookingPaid(id: string) {
  const supabase = await createAdminServerClient();
  const { error } = await supabase
    .from("bookings")
    .update({ payment_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "تعذر تحديث حالة الحجز" };

  revalidatePath("/admin/bookings");
  return { success: true };
}

export async function cancelBooking(id: string) {
  const supabase = await createAdminServerClient();
  const { error } = await supabase.from("bookings").update({ payment_status: "cancelled" }).eq("id", id);

  if (error) return { error: "تعذر إلغاء الحجز" };

  revalidatePath("/admin/bookings");
  return { success: true };
}
