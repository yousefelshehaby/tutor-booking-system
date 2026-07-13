import { NextRequest, NextResponse } from "next/server";
import { verifyPaymobHmac } from "@/lib/paymob/hmac";
import { createServiceClient } from "@/lib/supabase/service";

interface PaymobTransaction {
  id: number;
  success: boolean;
  order?: { id: number; merchant_order_id?: string | null };
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const receivedHmac = request.nextUrl.searchParams.get("hmac");

  if (!receivedHmac) {
    return NextResponse.json({ error: "Missing HMAC" }, { status: 401 });
  }

  let body: { obj?: PaymobTransaction };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transaction = body.obj;
  if (!transaction) {
    return NextResponse.json({ error: "Missing transaction payload" }, { status: 400 });
  }

  const merchantOrderId = transaction.order?.merchant_order_id;
  const paymobOrderId = transaction.order?.id;

  if (!merchantOrderId) {
    console.error("Paymob webhook missing merchant_order_id", { transactionId: transaction.id });
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceClient();

  // Resolve which tutor this transaction belongs to (currently only
  // bookings; monthly_payments will be added the same way) so we can verify
  // the HMAC with THAT tutor's secret, not a global one.
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, booking_code, tutor_id, payment_status")
    .eq("booking_code", merchantOrderId)
    .single();

  if (bookingError || !booking) {
    console.error("Paymob webhook: no booking matches merchant_order_id", { merchantOrderId });
    return NextResponse.json({ received: true });
  }

  const { data: tutor, error: tutorError } = await supabase
    .from("tutors")
    .select("paymob_hmac_secret")
    .eq("id", booking.tutor_id)
    .single();

  if (tutorError || !tutor?.paymob_hmac_secret) {
    console.error("Paymob webhook: tutor has no HMAC secret configured", {
      tutorId: booking.tutor_id,
    });
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const isValid = verifyPaymobHmac(
    transaction as unknown as Record<string, unknown>,
    receivedHmac,
    tutor.paymob_hmac_secret
  );

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (transaction.success === true) {
    const { error } = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        paymob_order_id: paymobOrderId ? String(paymobOrderId) : undefined,
      })
      .eq("id", booking.id)
      .eq("payment_status", "pending");

    if (error) {
      console.error("Failed to mark booking paid from webhook", error, { merchantOrderId });
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }
  } else {
    console.error("Paymob transaction failed", {
      merchantOrderId,
      transactionId: transaction.id,
    });
  }

  return NextResponse.json({ received: true });
}
