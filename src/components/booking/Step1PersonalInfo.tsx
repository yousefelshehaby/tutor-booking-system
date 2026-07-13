"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { personalInfoSchema } from "@/lib/validation/booking";
import type { PersonalInfo } from "@/types/booking";

interface Props {
  value: PersonalInfo;
  onNext: (value: PersonalInfo) => void;
}

export function Step1PersonalInfo({ value, onNext }: Props) {
  const [form, setForm] = useState<PersonalInfo>(value);
  const [errors, setErrors] = useState<Partial<Record<keyof PersonalInfo, string>>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = personalInfoSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof PersonalInfo, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof PersonalInfo;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    onNext(form);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" dir="rtl">
      <div>
        <label htmlFor="studentName" className="mb-1 block text-sm font-medium text-zinc-700">
          اسم الطالب الكامل
        </label>
        <input
          id="studentName"
          type="text"
          placeholder="مثال: أحمد محمد علي"
          value={form.studentName}
          onChange={(e) => setForm({ ...form, studentName: e.target.value })}
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.studentName && <p className="mt-1 text-sm text-red-600">{errors.studentName}</p>}
      </div>

      <div>
        <label htmlFor="studentPhone" className="mb-1 block text-sm font-medium text-zinc-700">
          رقم هاتف الطالب
        </label>
        <input
          id="studentPhone"
          type="tel"
          inputMode="numeric"
          placeholder="01xxxxxxxxx"
          value={form.studentPhone}
          onChange={(e) => setForm({ ...form, studentPhone: e.target.value })}
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          dir="ltr"
        />
        {errors.studentPhone && (
          <p className="mt-1 text-sm text-red-600">{errors.studentPhone}</p>
        )}
      </div>

      <div>
        <label htmlFor="guardianPhone" className="mb-1 block text-sm font-medium text-zinc-700">
          رقم هاتف ولي الأمر
        </label>
        <input
          id="guardianPhone"
          type="tel"
          inputMode="numeric"
          placeholder="01xxxxxxxxx"
          value={form.guardianPhone}
          onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          dir="ltr"
        />
        {errors.guardianPhone && (
          <p className="mt-1 text-sm text-red-600">{errors.guardianPhone}</p>
        )}
      </div>

      <Button type="submit" className="mt-2 w-full">
        التالي
      </Button>
    </form>
  );
}
