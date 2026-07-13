"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MonthlyFlow } from "@/components/monthly/MonthlyFlow";
import { findEligibleBookings } from "@/app/[tutorSlug]/monthly/actions";
import { phoneSchema } from "@/lib/validation/booking";
import type { EligibleBooking } from "@/types/monthly";

type Step = "phone" | "book_cta" | "pay";

export function PhoneFirstEntry({
  tutorId,
  tutorSlug,
  bookingOpen,
  monthlyPaymentOpen,
}: {
  tutorId: string;
  tutorSlug: string;
  bookingOpen: boolean;
  monthlyPaymentOpen: boolean;
}) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<EligibleBooking[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = phoneSchema.safeParse(phone);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "رقم الهاتف غير صحيح");
      return;
    }

    setLoading(true);
    const result = await findEligibleBookings({ tutorId, phone });
    setLoading(false);

    if (result.success) {
      setBookings(result.bookings);
      setStep("pay");
    } else {
      setStep("book_cta");
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" dir="rtl">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">رقم هاتفك</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            dir="ltr"
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={loading || !phone.trim()}>
          {loading ? "جاري التحقق..." : "متابعة"}
        </Button>
      </form>
    );
  }

  if (step === "book_cta") {
    if (!bookingOpen) {
      return <p className="text-center text-zinc-500">الحجز غير متاح حاليًا</p>;
    }

    return (
      <div className="flex flex-col items-center gap-4 text-center" dir="rtl">
        <p className="text-zinc-600">لا يوجد حجز سابق مرتبط بهذا الرقم — يبدو إنك بتحجز لأول مرة.</p>
        <Link
          href={`/${tutorSlug}/book?phone=${encodeURIComponent(phone)}`}
          className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          احجز لأول مرة
        </Link>
        <button type="button" onClick={() => setStep("phone")} className="text-sm text-zinc-500 hover:underline">
          رقم مختلف
        </button>
      </div>
    );
  }

  // step === "pay"
  if (!monthlyPaymentOpen) {
    return <p className="text-center text-zinc-500">الدفع الشهري غير متاح حاليًا</p>;
  }

  return <MonthlyFlow tutorId={tutorId} tutorSlug={tutorSlug} initialBookings={bookings} />;
}
