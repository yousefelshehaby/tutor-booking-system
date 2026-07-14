import { MonthlyFlow } from "@/components/monthly/MonthlyFlow";
import { resolveTutorOrNotFound } from "@/lib/tutor/resolve-tutor";
import { createAnonServerClient } from "@/lib/supabase/server";
import type { Settings } from "@/types/monthly";

export default async function MonthlyPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ tutorSlug: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { tutorSlug } = await params;
  const { phone } = await searchParams;
  const tutor = await resolveTutorOrNotFound(tutorSlug);

  const supabase = createAnonServerClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("monthly_payment_open")
    .eq("tutor_id", tutor.id)
    .maybeSingle<Pick<Settings, "monthly_payment_open">>();

  const monthlyPaymentOpen = settings?.monthly_payment_open ?? true;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6 sm:py-10" dir="rtl">
      <div className="w-full max-w-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-zinc-900">كشف الحساب</h1>
        <MonthlyFlow
          tutorId={tutor.id}
          tutorSlug={tutor.slug}
          monthlyPaymentOpen={monthlyPaymentOpen}
          initialPhone={phone}
        />
      </div>
    </main>
  );
}
