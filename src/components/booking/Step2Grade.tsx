"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getActiveGrades } from "@/app/[tutorSlug]/book/actions";
import type { Grade } from "@/types/booking";

interface Props {
  tutorId: string;
  value: string | null;
  onNext: (gradeId: string) => void;
  onBack: () => void;
}

export function Step2Grade({ tutorId, value, onNext, onBack }: Props) {
  const [grades, setGrades] = useState<Grade[] | null>(null);
  const [selected, setSelected] = useState<string | null>(value);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getActiveGrades(tutorId)
      .then(setGrades)
      .catch((err: Error) => setLoadError(err.message));
  }, [tutorId]);

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {!grades && !loadError && (
        <p className="text-center text-zinc-500">جاري تحميل الصفوف الدراسية...</p>
      )}

      {grades && grades.length === 0 && (
        <p className="text-center text-zinc-500">لا توجد صفوف دراسية متاحة حاليًا</p>
      )}

      {grades && grades.length > 0 && (
        <div className="flex flex-col gap-3">
          {grades.map((grade) => (
            <button
              key={grade.id}
              type="button"
              onClick={() => setSelected(grade.id)}
              className={`rounded-xl border-2 px-4 py-4 text-right text-base font-medium transition-colors ${
                selected === grade.id
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
              }`}
            >
              {grade.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack} className="flex-1">
          السابق
        </Button>
        <Button
          type="button"
          disabled={!selected}
          onClick={() => selected && onNext(selected)}
          className="flex-1"
        >
          التالي
        </Button>
      </div>
    </div>
  );
}
