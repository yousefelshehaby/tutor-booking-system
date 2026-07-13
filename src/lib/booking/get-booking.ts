import "server-only";
import { createAnonServerClient } from "@/lib/supabase/server";
import type { BookingDetails } from "@/types/booking";

export async function getBookingByCode(code: string): Promise<BookingDetails | null> {
  const supabase = createAnonServerClient();
  await supabase.rpc("expire_stale_reservations");

  const { data, error } = await supabase
    .rpc("get_booking_by_code", { p_code: code })
    .single<BookingDetails>();

  if (error || !data) {
    return null;
  }

  return data;
}
