"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { findEligibleBookings, getMonthlyStatus, payMonth } from "@/app/[tutorSlug]/monthly/actions";
import { formatMonth } from "@/lib/utils/format-month";
import type { PaymentMethod } from "@/types/booking";
import type { EligibleBooking, MonthlyPaymentStatus } from "@/types/monthly";

type Step = "lookup" | "select" | "status";

const PAYMENT_OPTIONS: { value: Exclude<PaymentMethod, "reserve_only">; label: string; icon: string }[] = [
  { value: "card", label: "بطاقة بنكية", icon: "💳" },
  { value: "wallet", label: "محفظة إلكترونية", icon: "📱" },
  { value: "fawry", label: "فوري", icon: "🏪" },
];

export function MonthlyFlow({ tutorId, tutorSlug }: { tutorId: string; tutorSlug: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("lookup");
  const [lookupMode, setLookupMode] = useState<"code" | "phone">("code");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [candidates, setCandidates] = useState<EligibleBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<EligibleBooking | null>(null);

  const [months, setMonths] = useState<MonthlyPaymentStatus[] | null>(null);
  const [payingMonth, setPayingMonth] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function handleLookupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setLookupLoading(true);

    const result = await findEligibleBookings({
      tutorId,
      code: lookupMode === "code" ? lookupValue : undefined,
      phone: lookupMode === "phone" ? lookupValue : undefined,
    });

    setLookupLoading(false);

    if (!result.success) {
      setLookupError(result.error);
      return;
    }

    if (result.bookings.length === 1) {
      await selectBooking(result.bookings[0]);
      return;
    }

    setCandidates(result.bookings);
    setStep("select");
  }

  async function selectBooking(booking: EligibleBooking) {
    setSelectedBooking(booking);
    setMonths(null);
    setStep("status");
    try {
      const status = await getMonthlyStatus(booking.booking_id);
      setMonths(status);
    } catch {
      setLookupError("تعذر تحميل حالة الاشتراك الشهري");
      setStep("lookup");
    }
  }

  async function handlePay(month: string, paymentMethod: Exclude<PaymentMethod, "reserve_only">) {
    if (!selectedBooking) return;
    setPaySubmitting(true);
    setPayError(null);

    const result = await payMonth({
      tutorId,
      bookingId: selectedBooking.booking_id,
      month,
      paymentMethod,
      studentName: selectedBooking.student_name,
      studentPhone: selectedBooking.student_phone,
    });

    setPaySubmitting(false);

    if (result.type === "error") {
      setPayError(result.message);
      return;
    }

    if (result.type === "redirect") {
      // eslint-disable-next-line react-hooks/immutability -- full-page redirect to an external Paymob URL, not component state
      window.location.href = result.url;
      return;
    }

    router.push(
      `/${tutorSlug}/payment/fawry?code=${encodeURIComponent(selectedBooking.booking_code)}&ref=${encodeURIComponent(result.billReference)}`
    );
  }

  if (step === "lookup") {
    return (
      <form onSubmit={handleLookupSubmit} className="flex flex-col gap-5" dir="rtl">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setLookupMode("code")}
            className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium ${
              lookupMode === "code" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-600"
            }`}
          >
            كود الحجز
          </button>
          <button
            type="button"
            onClick={() => setLookupMode("phone")}
            className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium ${
              lookupMode === "phone" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-600"
            }`}
          >
            رقم الهاتف
          </button>
        </div>

        <input
          value={lookupValue}
          onChange={(e) => setLookupValue(e.target.value)}
          placeholder={lookupMode === "code" ? "BK-2026-0001" : "01xxxxxxxxx"}
          dir="ltr"
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}

        <Button type="submit" disabled={lookupLoading || !lookupValue.trim()}>
          {lookupLoading ? "جاري البحث..." : "بحث"}
        </Button>
      </form>
    );
  }

  if (step === "select") {
    return (
      <div className="flex flex-col gap-3" dir="rtl">
        <p className="text-sm text-zinc-600">اختر الحجز المطلوب:</p>
        {candidates.map((booking) => (
          <button
            key={booking.booking_id}
            type="button"
            onClick={() => selectBooking(booking)}
            className="rounded-xl border-2 border-zinc-200 px-4 py-4 text-right hover:border-zinc-300"
          >
            <p className="font-semibold text-zinc-900">{booking.student_name}</p>
            <p className="mt-1 text-sm text-zinc-600">
              {booking.grade_name} — {booking.group_name}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{booking.booking_code}</p>
          </button>
        ))}
        <Button type="button" variant="secondary" onClick={() => setStep("lookup")}>
          السابق
        </Button>
      </div>
    );
  }

  // step === "status"
  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {selectedBooking && (
        <div className="rounded-xl bg-zinc-50 p-4 text-center">
          <p className="font-semibold text-zinc-900">{selectedBooking.student_name}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {selectedBooking.grade_name} — {selectedBooking.group_name}
          </p>
        </div>
      )}

      {!months && <p className="text-center text-zinc-500">جاري التحميل...</p>}

      {months && (
        <div className="flex flex-col gap-3">
          {months.map((m) => (
            <div key={m.month} className="rounded-xl border-2 border-zinc-200 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-900">{formatMonth(m.month)}</span>
                {m.is_paid ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    مدفوع ✓
                  </span>
                ) : (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                    غير مدفوع
                  </span>
                )}
              </div>

              {!m.is_paid && (
                <div className="mt-3">
                  {payingMonth === m.month ? (
                    <div className="flex flex-col gap-2">
                      {PAYMENT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={paySubmitting}
                          onClick={() => handlePay(m.month, opt.value)}
                          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:border-zinc-300 disabled:opacity-50"
                        >
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                      {payError && <p className="text-sm text-red-600">{payError}</p>}
                      <button
                        type="button"
                        onClick={() => setPayingMonth(null)}
                        className="text-xs text-zinc-500 hover:underline"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => {
                        setPayError(null);
                        setPayingMonth(m.month);
                      }}
                    >
                      ادفع {m.amount} جنيه
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="secondary" onClick={() => setStep("lookup")}>
        بحث عن حجز آخر
      </Button>
    </div>
  );
}
