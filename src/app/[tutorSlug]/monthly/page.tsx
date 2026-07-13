import { MonthlyFlow } from "@/components/monthly/MonthlyFlow";
import { resolveTutorOrNotFound } from "@/lib/tutor/resolve-tutor";

export default async function MonthlyPaymentPage({
  params,
}: {
  params: Promise<{ tutorSlug: string }>;
}) {
  const { tutorSlug } = await params;
  const tutor = await resolveTutorOrNotFound(tutorSlug);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10" dir="rtl">
      <div className="w-full max-w-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-zinc-900">
          دفع الاشتراك الشهري
        </h1>
        <MonthlyFlow tutorId={tutor.id} tutorSlug={tutor.slug} />
      </div>
    </main>
  );
}
