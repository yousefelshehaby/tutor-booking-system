"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MonthlyFlow } from "@/components/monthly/MonthlyFlow";
import { findEligibleBookings } from "@/app/[tutorSlug]/monthly/actions";
import {
  findActiveReservation,
  payExistingReservation,
  type ActiveReservation,
} from "@/app/[tutorSlug]/book/reservation-actions";
import { retryPayment } from "@/lib/booking/retry-payment";
import { phoneSchema } from "@/lib/validation/booking";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit/message";
import type { EligibleBooking } from "@/types/monthly";
import type { PaymentMethod } from "@/types/booking";

type Step = "phone" | "book_cta" | "pay" | "reservation";

const PAYMENT_OPTIONS: { value: Exclude<PaymentMethod, "reserve_only">; label: string; icon: string }[] = [
  { value: "card", label: "بطاقة بنكية", icon: "💳" },
  { value: "wallet", label: "محفظة إلكترونية", icon: "📱" },
  { value: "fawry", label: "فوري", icon: "🏪" },
];

function hoursRemaining(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));
}

function navigateTo(url: string) {
  window.location.href = url;
}

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
  const [reservation, setReservation] = useState<ActiveReservation | null>(null);
  const [choosingMethod, setChoosingMethod] = useState(false);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReservation(null);
    setChoosingMethod(false);
    setPayError(null);

    const validation = phoneSchema.safeParse(phone);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "رقم الهاتف غير صحيح");
      return;
    }

    setLoading(true);
    const eligible = await findEligibleBookings({ tutorId, phone });

    if (eligible.success) {
      setLoading(false);
      setBookings(eligible.bookings);
      setStep("pay");
      return;
    }

    if (eligible.error === RATE_LIMIT_MESSAGE) {
      setLoading(false);
      setError(eligible.error);
      return;
    }

    const activeReservation = await findActiveReservation({ tutorId, phone });
    setLoading(false);

    if (activeReservation) {
      setReservation(activeReservation);
      setStep("reservation");
    } else {
      setStep("book_cta");
    }
  }

  async function handlePayReservation(paymentMethod: Exclude<PaymentMethod, "reserve_only">) {
    if (!reservation) return;
    setPaySubmitting(true);
    setPayError(null);

    const result = reservation.payment_method === "reserve_only"
      ? await payExistingReservation({
          tutorId,
          bookingCode: reservation.booking_code,
          paymentMethod,
          studentName: reservation.student_name,
          studentPhone: phone,
        })
      : await retryPayment(reservation.booking_code);

    setPaySubmitting(false);

    if (result.type === "error") {
      setPayError(result.message);
      return;
    }

    const destination =
      result.type === "redirect"
        ? result.url
        : `/${tutorSlug}/payment/fawry?code=${encodeURIComponent(reservation.booking_code)}&ref=${encodeURIComponent(result.billReference)}`;

    navigateTo(destination);
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

  if (step === "reservation" && reservation) {
    return (
      <div className="flex flex-col gap-4 text-center" dir="rtl">
        <div className="rounded-xl bg-zinc-50 p-4">
          <p className="font-semibold text-zinc-900">{reservation.student_name}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {reservation.grade_name} — {reservation.group_name}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{reservation.booking_code}</p>
        </div>

        {reservation.expires_at ? (
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-sm font-semibold text-yellow-800">
              عندك حجز غير مدفوع بالفعل — متبقي {hoursRemaining(reservation.expires_at)} ساعة على
              انتهاء حجزك، بعدها هيتم إلغاؤه تلقائيًا.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">عندك حجز لسه مكملتش دفعه.</p>
          </div>
        )}

        {choosingMethod ? (
          <div className="flex flex-col gap-2">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={paySubmitting}
                onClick={() => handlePayReservation(opt.value)}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-3 text-sm hover:border-zinc-300 disabled:opacity-50"
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
            {payError && <p className="text-sm text-red-600">{payError}</p>}
          </div>
        ) : (
          <Button
            type="button"
            disabled={paySubmitting}
            onClick={() => {
              if (reservation.payment_method === "reserve_only") {
                setChoosingMethod(true);
              } else {
                handlePayReservation(reservation.payment_method as Exclude<PaymentMethod, "reserve_only">);
              }
            }}
          >
            {paySubmitting ? "جاري التحويل..." : "ادفع الآن"}
          </Button>
        )}

        {payError && !choosingMethod && <p className="text-sm text-red-600">{payError}</p>}

        <button type="button" onClick={() => setStep("phone")} className="text-sm text-zinc-500 hover:underline">
          رقم مختلف
        </button>
      </div>
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

  // step === "pay" — the statement is always viewable; MonthlyFlow itself
  // hides only the "ادفع" buttons when monthlyPaymentOpen is false.
  return (
    <MonthlyFlow
      tutorId={tutorId}
      tutorSlug={tutorSlug}
      initialBookings={bookings}
      monthlyPaymentOpen={monthlyPaymentOpen}
    />
  );
}
