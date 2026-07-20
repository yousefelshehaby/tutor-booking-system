"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getGroupsForGrade } from "@/app/[tutorSlug]/book/actions";
import { joinWaitlist } from "@/app/[tutorSlug]/book/waitlist-actions";
import type { GroupWithAvailability } from "@/types/booking";

export interface WaitlistJoined {
  groupName: string;
  position: number;
  alreadyExisting: boolean;
}

interface Props {
  tutorId: string;
  gradeId: string;
  value: string | null;
  studentName: string;
  studentPhone: string;
  guardianPhone: string;
  onNext: (groupId: string) => void;
  onBack: () => void;
  onWaitlistJoined: (result: WaitlistJoined) => void;
}

export function Step3Group({
  tutorId,
  gradeId,
  value,
  studentName,
  studentPhone,
  guardianPhone,
  onNext,
  onBack,
  onWaitlistJoined,
}: Props) {
  const [groups, setGroups] = useState<GroupWithAvailability[] | null>(null);
  const [selected, setSelected] = useState<string | null>(value);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    getGroupsForGrade(tutorId, gradeId)
      .then(setGroups)
      .catch((err: Error) => setLoadError(err.message));
  }, [tutorId, gradeId]);

  async function handleJoinWaitlist(group: GroupWithAvailability) {
    setJoiningGroupId(group.id);
    setJoinError(null);

    const result = await joinWaitlist({
      tutorId,
      gradeId,
      groupId: group.id,
      studentName,
      studentPhone,
      guardianPhone,
    });

    setJoiningGroupId(null);

    if (!result.success) {
      setJoinError(result.error);
      return;
    }

    onWaitlistJoined({
      groupName: group.name,
      position: result.position,
      alreadyExisting: result.alreadyExisting,
    });
  }

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

            if (isFull) {
              return (
                <div
                  key={group.id}
                  className="rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-4 text-right"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-zinc-900">{group.name}</span>
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                      مكتملة
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">
                    {group.days} — {group.time}
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-800">{group.price} جنيه</p>
                  <button
                    type="button"
                    disabled={joiningGroupId === group.id}
                    onClick={() => handleJoinWaitlist(group)}
                    className="mt-3 w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {joiningGroupId === group.id
                      ? "جاري الانضمام..."
                      : "المجموعة مكتملة — انضم لقائمة الانتظار"}
                  </button>
                </div>
              );
            }

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelected(group.id)}
                className={`rounded-xl border-2 px-4 py-4 text-right transition-colors ${
                  isSelected ? "border-blue-600 bg-blue-50" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-zinc-900">{group.name}</span>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    {group.remaining_seats} مقعد متاح
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  {group.days} — {group.time}
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-800">{group.price} جنيه</p>
              </button>
            );
          })}
          {joinError && <p className="text-sm text-red-600">{joinError}</p>}
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
