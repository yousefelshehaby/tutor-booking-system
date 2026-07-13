import { Suspense } from "react";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { resolveTutorOrNotFound } from "@/lib/tutor/resolve-tutor";

export default async function BookPage({
  params,
}: {
  params: Promise<{ tutorSlug: string }>;
}) {
  const { tutorSlug } = await params;
  const tutor = await resolveTutorOrNotFound(tutorSlug);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <Suspense fallback={<p className="text-zinc-500">جاري التحميل...</p>}>
        <BookingWizard tutorId={tutor.id} tutorSlug={tutor.slug} />
      </Suspense>
    </main>
  );
}
