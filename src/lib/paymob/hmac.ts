import "server-only";
import crypto from "node:crypto";

// Exact field order required by Paymob's "Transaction" HMAC spec.
// https://docs.paymob.com/docs/transaction-callbacks
const HMAC_FIELD_ORDER = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
] as const;

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function verifyPaymobHmac(
  transaction: Record<string, unknown>,
  receivedHmac: string,
  secret: string
): boolean {
  const concatenated = HMAC_FIELD_ORDER.map((field) => {
    const value = getNestedValue(transaction, field);
    return value === null || value === undefined ? "" : String(value);
  }).join("");

  const computed = crypto.createHmac("sha512", secret).update(concatenated).digest("hex");

  if (computed.length !== receivedHmac.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(receivedHmac, "hex"));
  } catch {
    return false;
  }
}
