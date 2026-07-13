import "server-only";
import { createAnonServerClient } from "@/lib/supabase/server";

export interface MonthlyPaymentDetails {
  student_name: string;
  month: string;
  amount: number;
  payment_status: "pending" | "paid";
  booking_code: string;
  grade_name: string;
  group_name: string;
}

export async function getMonthlyPaymentById(id: string): Promise<MonthlyPaymentDetails | null> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .rpc("get_monthly_payment_by_id", { p_id: id })
    .single<MonthlyPaymentDetails>();

  if (error || !data) {
    return null;
  }

  return data;
}
