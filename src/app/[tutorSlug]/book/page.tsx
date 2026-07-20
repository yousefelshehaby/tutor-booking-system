import { Suspense } from "react";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { resolveTutorOrNotFound } from "@/lib/tutor/resolve-tutor";
import { createAnonServerClient } from "@/lib/supabase/server";
import type { Settings } from "@/types/monthly";

export default async function BookPage({
  params,
}: {
  params: Promise<{ tutorSlug: string }>;
}) {
  const { tutorSlug } = await params;
  const tutor = await resolveTutorOrNotFound(tutorSlug);

  const supabase = createAnonServerClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("online_payments_enabled")
    .eq("tutor_id", tutor.id)
    .maybeSingle<Pick<Settings, "online_payments_enabled">>();

  const onlinePaymentsEnabled = settings?.online_payments_enabled ?? false;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <Suspense fallback={<p className="text-zinc-500">جاري التحميل...</p>}>
        <BookingWizard
          tutorId={tutor.id}
          tutorSlug={tutor.slug}
          onlinePaymentsEnabled={onlinePaymentsEnabled}
        />
      </Suspense>
    </main>
  );
}
