"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getGroupsForGrade } from "@/app/[tutorSlug]/book/actions";
import type { GroupWithAvailability } from "@/types/booking";

interface Props {
  tutorId: string;
  gradeId: string;
  value: string | null;
  onNext: (groupId: string) => void;
  onBack: () => void;
}

export function Step3Group({ tutorId, gradeId, value, onNext, onBack }: Props) {
  const [groups, setGroups] = useState<GroupWithAvailability[] | null>(null);
  const [selected, setSelected] = useState<string | null>(value);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getGroupsForGrade(tutorId, gradeId)
      .then(setGroups)
      .catch((err: Error) => setLoadError(err.message));
  }, [tutorId, gradeId]);

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {!groups && !loadError && (
        <p className="text-center text-zinc-500">جاري تحميل المجموعات...</p>
      )}

      {groups && groups.length === 0 && (
        <p className="text-center text-zinc-500">لا توجد مجموعات متاحة لهذا الصف حاليًا</p>
      )}

      {groups && groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const isFull = group.remaining_seats <= 0;
            const isSelected = selected === group.id;

            return (
              <button
                key={group.id}
                type="button"
                disabled={isFull}
                onClick={() => setSelected(group.id)}
                className={`rounded-xl border-2 px-4 py-4 text-right transition-colors ${
                  isFull
                    ? "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-60"
                    : isSelected
                      ? "border-blue-600 bg-blue-50"
                      : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-zinc-900">{group.name}</span>
                  {isFull ? (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                      مكتملة
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      {group.remaining_seats} مقعد متاح
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  {group.days} — {group.time}
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-800">{group.price} جنيه</p>
              </button>
            );
          })}
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
