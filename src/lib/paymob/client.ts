import "server-only";

const PAYMOB_BASE_URL = "https://accept.paymob.com/api";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export async function authenticate(): Promise<string> {
  const apiKey = requireEnv("PAYMOB_API_KEY");

  const res = await fetch(`${PAYMOB_BASE_URL}/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!res.ok) throw new Error("Paymob authentication failed");
  const data = (await res.json()) as { token: string };
  return data.token;
}

export async function createOrder(params: {
  authToken: string;
  amountCents: number;
  merchantOrderId: string;
}): Promise<number> {
  const res = await fetch(`${PAYMOB_BASE_URL}/ecommerce/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: params.authToken,
      delivery_needed: false,
      amount_cents: params.amountCents,
      currency: "EGP",
      merchant_order_id: params.merchantOrderId,
      items: [],
    }),
  });

  if (!res.ok) throw new Error("Paymob order registration failed");
  const data = (await res.json()) as { id: number };
  return data.id;
}

interface BillingInfo {
  studentName: string;
  studentPhone: string;
}

function buildBillingData({ studentName, studentPhone }: BillingInfo) {
  const [firstName, ...rest] = studentName.trim().split(/\s+/);
  return {
    apartment: "NA",
    email: "student@example.com",
    floor: "NA",
    first_name: firstName || "Student",
    street: "NA",
    building: "NA",
    phone_number: studentPhone,
    shipping_method: "NA",
    postal_code: "NA",
    city: "NA",
    country: "EG",
    last_name: rest.join(" ") || "Student",
    state: "NA",
  };
}

export async function generatePaymentKey(params: {
  authToken: string;
  amountCents: number;
  orderId: number;
  integrationId: number;
  billing: BillingInfo;
}): Promise<string> {
  const res = await fetch(`${PAYMOB_BASE_URL}/acceptance/payment_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: params.authToken,
      amount_cents: params.amountCents,
      expiration: 3600,
      order_id: params.orderId,
      billing_data: buildBillingData(params.billing),
      currency: "EGP",
      integration_id: params.integrationId,
    }),
  });

  if (!res.ok) throw new Error("Paymob payment key generation failed");
  const data = (await res.json()) as { token: string };
  return data.token;
}

export function buildIframeUrl(paymentToken: string): string {
  const iframeId = requireEnv("PAYMOB_IFRAME_ID");
  return `${PAYMOB_BASE_URL}/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`;
}

export async function payWithWallet(params: {
  paymentToken: string;
  walletPhone: string;
}): Promise<{ redirectUrl: string }> {
  const res = await fetch(`${PAYMOB_BASE_URL}/acceptance/payments/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: { identifier: params.walletPhone, subtype: "WALLET" },
      payment_token: params.paymentToken,
    }),
  });

  if (!res.ok) throw new Error("Paymob wallet payment request failed");
  const data = (await res.json()) as { redirect_url?: string };
  if (!data.redirect_url) throw new Error("Paymob did not return a wallet redirect URL");
  return { redirectUrl: data.redirect_url };
}

export async function payWithFawry(params: {
  paymentToken: string;
}): Promise<{ billReference: string }> {
  const res = await fetch(`${PAYMOB_BASE_URL}/acceptance/payments/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: { identifier: "AGGREGATOR", subtype: "AGGREGATOR" },
      payment_token: params.paymentToken,
    }),
  });

  if (!res.ok) throw new Error("Paymob Fawry payment request failed");
  const data = (await res.json()) as { data?: { bill_reference?: string | number } };
  const billReference = data.data?.bill_reference;
  if (billReference === undefined) throw new Error("Paymob did not return a Fawry bill reference");
  return { billReference: String(billReference) };
}

export function integrationIdFor(method: "card" | "wallet" | "fawry"): number {
  const envVar = {
    card: "PAYMOB_CARD_INTEGRATION_ID",
    wallet: "PAYMOB_WALLET_INTEGRATION_ID",
    fawry: "PAYMOB_FAWRY_INTEGRATION_ID",
  }[method];

  return Number(requireEnv(envVar));
}
