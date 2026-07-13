import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { TutorProfileEditor } from "@/components/admin/TutorProfileEditor";

export default async function TutorProfilePage({
  params,
}: {
  params: Promise<{ tutorId: string }>;
}) {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) {
    redirect("/admin/dashboard");
  }

  const { tutorId } = await params;
  const supabase = await createAdminServerClient();
  const { data: tutor } = await supabase
    .from("tutors")
    .select(
      "id, name, slug, phone, is_active, photo_url, bank_name, bank_account_holder, bank_account_number, paymob_api_key, paymob_hmac_secret, paymob_card_integration_id, paymob_wallet_integration_id, paymob_fawry_integration_id, paymob_iframe_id"
    )
    .eq("id", tutorId)
    .single();

  if (!tutor) {
    notFound();
  }

  // Login email lives on admin_users, not tutors — service client since
  // reading another tutor's admin_users row is outside the RLS scope of
  // the currently "active" tutor context.
  const service = createServiceClient();
  const { data: adminUser } = await service
    .from("admin_users")
    .select("id, email")
    .eq("tutor_id", tutorId)
    .eq("role", "tutor")
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/tutors" className="text-sm text-blue-600 hover:underline">
          المدرّسون
        </Link>
        <span className="text-zinc-400">/</span>
        <h1 className="text-2xl font-bold text-zinc-900">{tutor.name}</h1>
      </div>

      <TutorProfileEditor tutor={tutor} adminEmail={adminUser?.email ?? null} />
    </div>
  );
}
