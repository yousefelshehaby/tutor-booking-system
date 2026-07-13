import "server-only";
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
  | { type: "redirect"; url: string; paymobOrderId: string }
  | { type: "fawry_reference"; billReference: string; paymobOrderId: string };

/**
 * Runs the Paymob auth -> order -> payment-key flow. `merchantOrderId` is
 * whatever string the caller wants Paymob to echo back later (a booking
 * code for the initial payment, or "MP-<monthly_payments.id>" for a
 * monthly fee) — this function is deliberately unaware of which table that
 * maps to. The caller is responsible for persisting the returned
 * `paymobOrderId` onto its own row.
 */
export async function initiatePayment(params: {
  merchantOrderId: string;
  amount: number;
  paymentMethod: Exclude<PaymentMethod, "reserve_only">;
  studentName: string;
  studentPhone: string;
  credentials: TutorPaymobCredentials;
}): Promise<InitiatePaymentResult> {
  const { merchantOrderId, amount, paymentMethod, studentName, studentPhone, credentials } =
    params;
  const amountCents = Math.round(amount * 100);

  const authToken = await authenticate(credentials.apiKey);
  const orderId = await createOrder({ authToken, amountCents, merchantOrderId });
  const paymobOrderId = String(orderId);

  const integrationId = integrationIdFor(paymentMethod, credentials);
  const paymentToken = await generatePaymentKey({
    authToken,
    amountCents,
    orderId,
    integrationId,
    billing: { studentName, studentPhone },
  });

  if (paymentMethod === "card") {
    return { type: "redirect", url: buildIframeUrl(paymentToken, credentials.iframeId), paymobOrderId };
  }

  if (paymentMethod === "wallet") {
    const { redirectUrl } = await payWithWallet({ paymentToken, walletPhone: studentPhone });
    return { type: "redirect", url: redirectUrl, paymobOrderId };
  }

  const { billReference } = await payWithFawry({ paymentToken });
  return { type: "fawry_reference", billReference, paymobOrderId };
}
