import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { SettingsForm } from "@/components/admin/SettingsForm";
import type { Settings } from "@/types/monthly";

export default async function AdminSettingsPage() {
  const { tutorId } = await getCurrentAdmin();
  const supabase = await createAdminServerClient();

  let settings: Settings | null = null;
  if (tutorId) {
    const { data } = await supabase
      .from("settings")
      .select("tutor_id, booking_open, monthly_payment_open, online_payments_enabled, current_month")
      .eq("tutor_id", tutorId)
      .maybeSingle<Settings>();
    settings = data;
  }

  const defaults: Settings = settings ?? {
    tutor_id: tutorId ?? "",
    booking_open: true,
    monthly_payment_open: true,
    online_payments_enabled: false,
    current_month: new Date().toISOString().slice(0, 7),
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">الإعدادات</h1>
      <SettingsForm settings={defaults} />
    </div>
  );
}
