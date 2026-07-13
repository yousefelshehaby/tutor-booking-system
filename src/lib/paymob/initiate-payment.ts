import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  authenticate,
  buildIframeUrl,
  createOrder,
  generatePaymentKey,
  integrationIdFor,
  payWithFawry,
  payWithWallet,
  type TutorPaymobCredentials,
} from "@/lib/paymob/client";
import type { PaymentMethod } from "@/types/booking";

export type InitiatePaymentResult =
  | { type: "redirect"; url: string }
  | { type: "fawry_reference"; billReference: string };

export async function initiatePayment(params: {
  bookingCode: string;
  amount: number;
  paymentMethod: Exclude<PaymentMethod, "reserve_only">;
  studentName: string;
  studentPhone: string;
  credentials: TutorPaymobCredentials;
}): Promise<InitiatePaymentResult> {
  const { bookingCode, amount, paymentMethod, studentName, studentPhone, credentials } = params;
  const amountCents = Math.round(amount * 100);

  const authToken = await authenticate(credentials.apiKey);
  const orderId = await createOrder({ authToken, amountCents, merchantOrderId: bookingCode });

  const supabase = createServiceClient();
  await supabase
    .from("bookings")
    .update({ paymob_order_id: String(orderId) })
    .eq("booking_code", bookingCode);

  const integrationId = integrationIdFor(paymentMethod, credentials);
  const paymentToken = await generatePaymentKey({
    authToken,
    amountCents,
    orderId,
    integrationId,
    billing: { studentName, studentPhone },
  });

  if (paymentMethod === "card") {
    return { type: "redirect", url: buildIframeUrl(paymentToken, credentials.iframeId) };
  }

  if (paymentMethod === "wallet") {
    const { redirectUrl } = await payWithWallet({ paymentToken, walletPhone: studentPhone });
    return { type: "redirect", url: redirectUrl };
  }

  const { billReference } = await payWithFawry({ paymentToken });
  return { type: "fawry_reference", billReference };
}
