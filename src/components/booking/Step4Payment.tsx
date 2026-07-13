"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PaymentMethod } from "@/types/booking";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string; hint?: string }[] = [
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

interface Props {
  value: PaymentMethod | null;
  onSubmit: (method: PaymentMethod) => void;
  onBack: () => void;
  submitting: boolean;
  submitError: string | null;
}

export function Step4Payment({ value, onSubmit, onBack, submitting, submitError }: Props) {
  const [selected, setSelected] = useState<PaymentMethod | null>(value);

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      <div className="flex flex-col gap-3">
        {PAYMENT_OPTIONS.map((option) => (
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
