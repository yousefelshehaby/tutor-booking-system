import "server-only";

export interface InitiatePaymentResult {
  paymentUrl: string;
}

/**
 * Placeholder for the real Paymob flow (auth token -> order registration ->
 * payment key -> hosted checkout URL), implemented in Phase 3. For now it
 * just points back to the booking's own success page so the flow is fully
 * clickable end to end before Paymob is wired in.
 */
export async function initiatePayment(bookingCode: string): Promise<InitiatePaymentResult> {
  return {
    paymentUrl: `/booking/${bookingCode}`,
  };
}
