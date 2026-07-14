"use server";

import { createAdminServerClient } from "@/lib/supabase/admin-server";

export interface MonthlyStripItem {
  month: string;
  is_paid: boolean;
}

export async function getMonthlyStripForBooking(bookingId: string): Promise<MonthlyStripItem[]> {
  const supabase = await createAdminServerClient();
  const { data, error } = await supabase.rpc("get_monthly_payment_status", { p_booking_id: bookingId });

  if (error) return [];

  return ((data ?? []) as { month: string; is_paid: boolean }[]).map((row) => ({
    month: row.month,
    is_paid: row.is_paid,
  }));
}
