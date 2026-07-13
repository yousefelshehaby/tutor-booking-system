import Link from "next/link";
import { resolveTutorOrNotFound } from "@/lib/tutor/resolve-tutor";
import { createAnonServerClient } from "@/lib/supabase/server";
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
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
          احجز مكانك في الدروس الخصوصية مع {tutor.name}
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600">
          اختر الصف الدراسي والمجموعة المناسبة لك، وادفع أونلاين بسهولة وأمان.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {bookingOpen && (
            <Link
              href={`/${tutor.slug}/book`}
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              احجز الآن
            </Link>
          )}

          {monthlyPaymentOpen && (
            <Link
              href={`/${tutor.slug}/monthly`}
              className="inline-flex w-full items-center justify-center rounded-xl border-2 border-blue-600 bg-white px-6 py-4 text-lg font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
            >
              ادفع اشتراك الشهر
            </Link>
          )}

          {!bookingOpen && !monthlyPaymentOpen && (
            <p className="text-zinc-500">الحجز والدفع الشهري غير متاحين حاليًا</p>
          )}
        </div>
      </div>
    </main>
  );
}
