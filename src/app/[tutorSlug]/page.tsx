import { resolveTutorOrNotFound } from "@/lib/tutor/resolve-tutor";
import { createAnonServerClient } from "@/lib/supabase/server";
import { PhoneFirstEntry } from "@/components/tutor/PhoneFirstEntry";
import type { Settings } from "@/types/monthly";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ tutorSlug: string }>;
}) {
  const { tutorSlug } = await params;
  const tutor = await resolveTutorOrNotFound(tutorSlug);

  const supabase = createAnonServerClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("tutor_id, booking_open, monthly_payment_open, current_month")
    .eq("tutor_id", tutor.id)
    .maybeSingle<Settings>();

  const bookingOpen = settings?.booking_open ?? true;
  const monthlyPaymentOpen = settings?.monthly_payment_open ?? true;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">{tutor.name}</h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600">
          أدخل رقم هاتفك عشان نحدد إذا كنت طالب جديد هتحجز، أو طالب مسجل هتدفع اشتراكك.
        </p>

        <div className="mt-8">
          <PhoneFirstEntry
            tutorId={tutor.id}
            tutorSlug={tutor.slug}
            bookingOpen={bookingOpen}
            monthlyPaymentOpen={monthlyPaymentOpen}
          />
        </div>
      </div>
    </main>
  );
}
