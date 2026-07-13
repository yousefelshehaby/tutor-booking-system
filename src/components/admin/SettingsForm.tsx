"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { updateSettings } from "@/app/admin/(protected)/settings/actions";
import type { Settings } from "@/types/monthly";

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [bookingOpen, setBookingOpen] = useState(settings.booking_open);
  const [monthlyPaymentOpen, setMonthlyPaymentOpen] = useState(settings.monthly_payment_open);
  const [currentMonth, setCurrentMonth] = useState(settings.current_month);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const result = await updateSettings({
      booking_open: bookingOpen,
      monthly_payment_open: monthlyPaymentOpen,
      current_month: currentMonth,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-md flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-6"
      dir="rtl"
    >
      <label className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">استقبال حجوزات جديدة</span>
        <input
          type="checkbox"
          checked={bookingOpen}
          onChange={(e) => setBookingOpen(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <label className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">استقبال المدفوعات الشهرية</span>
        <input
          type="checkbox"
          checked={monthlyPaymentOpen}
          onChange={(e) => setMonthlyPaymentOpen(e.target.checked)}
          className="h-5 w-5"
        />
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">الشهر الحالي</label>
        <input
          type="month"
          value={currentMonth}
          onChange={(e) => setCurrentMonth(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">تم الحفظ بنجاح</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
      </Button>
    </form>
  );
}
