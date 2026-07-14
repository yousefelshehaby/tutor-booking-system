"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  findEligibleBookings,
  getAccountStatementHeader,
  getMonthlyStatus,
  payMonth,
} from "@/app/[tutorSlug]/monthly/actions";
import { formatMonth } from "@/lib/utils/format-month";
import type { PaymentMethod } from "@/types/booking";
import type { AccountStatementHeader, EligibleBooking, MonthlyPaymentStatus } from "@/types/monthly";

type Step = "lookup" | "select" | "status";

const PAYMENT_OPTIONS: { value: Exclude<PaymentMethod, "reserve_only">; label: string; icon: string }[] = [
  { value: "card", label: "بطاقة بنكية", icon: "💳" },
  { value: "wallet", label: "محفظة إلكترونية", icon: "📱" },
  { value: "fawry", label: "فوري", icon: "🏪" },
];

const STATEMENT_METHOD_LABELS: Record<string, string> = {
  card: "بطاقة",
  wallet: "محفظة",
  fawry: "فوري",
  reserve_only: "يدوي",
};

function formatMonthsCount(n: number): string {
  if (n === 0) return "لا يوجد";
  if (n === 1) return "شهر واحد";
  if (n === 2) return "شهرين";
  if (n <= 10) return `${n} شهور`;
  return `${n} شهر`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

interface Props {
  tutorId: string;
  tutorSlug: string;
  /** When provided (e.g. the caller already looked up by phone), skip the lookup step entirely. */
  initialBookings?: EligibleBooking[];
  /** Statement is always viewable; this only controls whether "ادفع" buttons show. */
  monthlyPaymentOpen: boolean;
  /** Pre-fills the phone lookup (e.g. arriving from /my-account) — student still confirms with "بحث". */
  initialPhone?: string;
}

export function MonthlyFlow({
  tutorId,
  tutorSlug,
  initialBookings,
  monthlyPaymentOpen,
  initialPhone,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    initialBookings && initialBookings.length > 0 ? "select" : "lookup"
  );
  const [lookupMode, setLookupMode] = useState<"code" | "phone">(initialPhone ? "phone" : "code");
  const [lookupValue, setLookupValue] = useState(initialPhone ?? "");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [candidates, setCandidates] = useState<EligibleBooking[]>(initialBookings ?? []);
  const [selectedBooking, setSelectedBooking] = useState<EligibleBooking | null>(null);

  const [header, setHeader] = useState<AccountStatementHeader | null>(null);
  const [months, setMonths] = useState<MonthlyPaymentStatus[] | null>(null);
  const [payingMonth, setPayingMonth] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBookings && initialBookings.length === 1) {
      selectBooking(initialBookings[0]);
    }
    // Only run once on mount for the pre-resolved single-booking case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setHeader(null);
    setMonths(null);
    setStep("status");
    try {
      const [status, statementHeader] = await Promise.all([
        getMonthlyStatus(booking.booking_id),
        getAccountStatementHeader(booking.booking_id),
      ]);
      setMonths(status);
      setHeader(statementHeader);
    } catch {
      setLookupError("تعذر تحميل كشف الحساب");
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

  // step === "status" — full account statement
  const paidMonths = months?.filter((m) => m.is_paid) ?? [];
  const unpaidMonths = months?.filter((m) => !m.is_paid) ?? [];
  const paidMonthsAmount = paidMonths.reduce((sum, m) => sum + Number(m.amount), 0);
  const unpaidAmount = unpaidMonths.reduce((sum, m) => sum + Number(m.amount), 0);
  const totalPaidWithBooking = paidMonthsAmount + (header ? Number(header.booking_amount) : 0);

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {header && (
        <div className="rounded-xl bg-zinc-50 p-4 text-center">
          <p className="text-lg font-bold text-zinc-900">{header.student_name}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {header.grade_name} — {header.group_name}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {header.group_days} — {header.group_time}
          </p>
        </div>
      )}

      {(!months || !header) && <p className="text-center text-zinc-500">جاري التحميل...</p>}

      {months && header && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-green-200 bg-green-50 p-3 text-center sm:p-4">
              <p className="text-xs font-semibold text-green-700">المدفوع</p>
              <p className="mt-1 text-base font-bold text-green-800 sm:text-lg">
                دفعت {formatMonthsCount(paidMonths.length)}
              </p>
              <p className="text-sm font-medium text-green-700">
                {totalPaidWithBooking.toLocaleString("ar-EG")} جنيه
              </p>
            </div>
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-center sm:p-4">
              <p className="text-xs font-semibold text-red-700">المتبقي</p>
              <p className="mt-1 text-base font-bold text-red-800 sm:text-lg">
                {unpaidMonths.length > 0 ? `متبقي ${formatMonthsCount(unpaidMonths.length)}` : "لا يوجد ✓"}
              </p>
              {unpaidMonths.length > 0 && (
                <p className="text-sm font-medium text-red-700">
                  {unpaidAmount.toLocaleString("ar-EG")} جنيه
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
            <span className="font-medium text-zinc-700">رسوم الحجز</span>
            <span className="flex items-center gap-2">
              <span className="text-zinc-900">{Number(header.booking_amount).toLocaleString("ar-EG")} جنيه</span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                مدفوع ✓
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {[...months].reverse().map((m) => (
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

                <p className="mt-1 text-sm text-zinc-600">{Number(m.amount).toLocaleString("ar-EG")} جنيه</p>

                {m.is_paid && m.paid_at && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatDate(m.paid_at)}
                    {m.payment_method && ` — ${STATEMENT_METHOD_LABELS[m.payment_method] ?? m.payment_method}`}
                  </p>
                )}

                {!m.is_paid && monthlyPaymentOpen && (
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
                        ادفع {Number(m.amount).toLocaleString("ar-EG")} جنيه
                      </Button>
                    )}
                  </div>
                )}

                {!m.is_paid && !monthlyPaymentOpen && (
                  <p className="mt-2 text-xs text-zinc-500">الدفع الإلكتروني مغلق حاليًا</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Button type="button" variant="secondary" onClick={() => setStep("lookup")}>
        بحث عن حجز آخر
      </Button>
    </div>
  );
}
