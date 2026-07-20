"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  ONLINE_METHOD_OPTIONS,
  ONLINE_PAYMENTS_COMING_SOON_NOTE,
  CASH_PAYMENT_EXPIRY_HINT,
} from "@/lib/booking/payment-options";
import type { PaymentMethod } from "@/types/booking";

const ONLINE_MODE_OPTIONS: { value: PaymentMethod; label: string; icon: string; hint?: string }[] = [
  { value: "card", label: "بطاقة بنكية", icon: "💳" },
  { value: "wallet", label: "محفظة إلكترونية", icon: "📱" },
  { value: "fawry", label: "فوري", icon: "🏪" },
  {
    value: "reserve_only",
    label: "حجز بدون دفع الآن",
    icon: "📝",
    hint: "يجب الدفع خلال 48 ساعة وإلا يُلغى الحجز تلقائيًا",
  },
];

const CASH_MODE_OPTIONS: { value: PaymentMethod; label: string; icon: string; hint?: string }[] = [
  { value: "reserve_only", label: "الدفع نقدًا", icon: "💵", hint: CASH_PAYMENT_EXPIRY_HINT },
];

interface Props {
  value: PaymentMethod | null;
  onSubmit: (method: PaymentMethod) => void;
  onBack: () => void;
  submitting: boolean;
  submitError: string | null;
  onlinePaymentsEnabled: boolean;
}

export function Step4Payment({
  value,
  onSubmit,
  onBack,
  submitting,
  submitError,
  onlinePaymentsEnabled,
}: Props) {
  const [selected, setSelected] = useState<PaymentMethod | null>(value);
  const options = onlinePaymentsEnabled ? ONLINE_MODE_OPTIONS : CASH_MODE_OPTIONS;

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {!onlinePaymentsEnabled && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="mb-3 text-xs font-medium text-zinc-500">{ONLINE_PAYMENTS_COMING_SOON_NOTE}</p>
          <div className="flex flex-col gap-2 opacity-50">
            {ONLINE_METHOD_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl border-2 border-zinc-200 px-4 py-3"
              >
                <span className="text-xl">{opt.icon}</span>
                <span className="text-sm font-semibold text-zinc-500">{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSelected(option.value)}
            className={`flex items-start gap-3 rounded-xl border-2 px-4 py-4 text-right transition-colors ${
              selected === option.value
                ? "border-blue-600 bg-blue-50"
                : "border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <span className="text-2xl">{option.icon}</span>
            <span className="flex flex-col">
              <span className="text-base font-semibold text-zinc-900">{option.label}</span>
              {option.hint && <span className="mt-0.5 text-xs text-zinc-500">{option.hint}</span>}
            </span>
          </button>
        ))}
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <div className="mt-2 flex gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={submitting}
          className="flex-1"
        >
          السابق
        </Button>
        <Button
          type="button"
          disabled={!selected || submitting}
          onClick={() => selected && onSubmit(selected)}
          className="flex-1"
        >
          {submitting ? "جاري تأكيد الحجز..." : "تأكيد الحجز"}
        </Button>
      </div>
    </div>
  );
}
