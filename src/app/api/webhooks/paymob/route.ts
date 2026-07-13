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

  // Resolve which record and tutor this transaction belongs to, so we can
  // verify the HMAC with THAT tutor's secret — never a global one.
  const target = merchantOrderId.startsWith("MP-")
    ? await resolveMonthlyPayment(supabase, merchantOrderId)
    : await resolveBooking(supabase, merchantOrderId);

  if (!target) {
    console.error("Paymob webhook: no record matches merchant_order_id", { merchantOrderId });
    return NextResponse.json({ received: true });
  }

  const { data: tutor, error: tutorError } = await supabase
    .from("tutors")
    .select("paymob_hmac_secret")
    .eq("id", target.tutorId)
    .single();

  if (tutorError || !tutor?.paymob_hmac_secret) {
    console.error("Paymob webhook: tutor has no HMAC secret configured", {
      tutorId: target.tutorId,
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
      .from(target.table)
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        paymob_order_id: paymobOrderId ? String(paymobOrderId) : undefined,
      })
      .eq("id", target.id)
      .eq("payment_status", "pending");

    if (error) {
      console.error("Failed to mark payment paid from webhook", error, { merchantOrderId });
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

interface PaymentTarget {
  table: "bookings" | "monthly_payments";
  id: string;
  tutorId: string;
}

async function resolveBooking(
  supabase: ReturnType<typeof createServiceClient>,
  merchantOrderId: string
): Promise<PaymentTarget | null> {
  const { data } = await supabase
    .from("bookings")
    .select("id, tutor_id")
    .eq("booking_code", merchantOrderId)
    .single();

  if (!data) return null;
  return { table: "bookings", id: data.id, tutorId: data.tutor_id };
}

async function resolveMonthlyPayment(
  supabase: ReturnType<typeof createServiceClient>,
  merchantOrderId: string
): Promise<PaymentTarget | null> {
  const monthlyPaymentId = merchantOrderId.slice("MP-".length);
  const { data } = await supabase
    .from("monthly_payments")
    .select("id, tutor_id")
    .eq("id", monthlyPaymentId)
    .single();

  if (!data) return null;
  return { table: "monthly_payments", id: data.id, tutorId: data.tutor_id };
}
