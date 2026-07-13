import { Suspense } from "react";
import { BookingWizard } from "@/components/booking/BookingWizard";

export default function BookPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <Suspense fallback={<p className="text-zinc-500">جاري التحميل...</p>}>
        <BookingWizard />
      </Suspense>
    </main>
  );
}
