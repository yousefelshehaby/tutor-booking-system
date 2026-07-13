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

  let isValid: boolean;
  try {
    isValid = verifyPaymobHmac(transaction as unknown as Record<string, unknown>, receivedHmac);
  } catch (err) {
    console.error("Paymob HMAC verification misconfigured", err);
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const merchantOrderId = transaction.order?.merchant_order_id;
  const paymobOrderId = transaction.order?.id;

  if (!merchantOrderId) {
    console.error("Paymob webhook missing merchant_order_id", { transactionId: transaction.id });
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceClient();

  if (transaction.success === true) {
    const { error } = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        paymob_order_id: paymobOrderId ? String(paymobOrderId) : undefined,
      })
      .eq("booking_code", merchantOrderId)
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
