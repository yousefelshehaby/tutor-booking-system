import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { TutorPaymobCredentials } from "@/lib/paymob/client";

export async function getTutorPaymobCredentials(
  tutorId: string
): Promise<TutorPaymobCredentials | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tutors")
    .select(
      "paymob_api_key, paymob_hmac_secret, paymob_card_integration_id, paymob_wallet_integration_id, paymob_fawry_integration_id, paymob_iframe_id"
    )
    .eq("id", tutorId)
    .single();

  if (error || !data || !data.paymob_api_key || !data.paymob_iframe_id) {
    return null;
  }

  return {
    apiKey: data.paymob_api_key,
    hmacSecret: data.paymob_hmac_secret ?? "",
    cardIntegrationId: data.paymob_card_integration_id ?? "",
    walletIntegrationId: data.paymob_wallet_integration_id ?? "",
    fawryIntegrationId: data.paymob_fawry_integration_id ?? "",
    iframeId: data.paymob_iframe_id,
  };
}
