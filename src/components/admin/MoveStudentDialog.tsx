"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getMoveTargetGroups, moveStudentToGroup } from "@/app/admin/(protected)/students/move-actions";
import type { GroupWithAvailability } from "@/types/booking";

export function MoveStudentDialog({
  bookingId,
  onClose,
  onMoved,
}: {
  bookingId: string;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [groups, setGroups] = useState<GroupWithAvailability[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMoveTargetGroups(bookingId).then(setGroups);
  }, [bookingId]);

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);

    const result = await moveStudentToGroup(bookingId, selected);

    setSubmitting(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    onMoved();
  }

  return (
    <Modal onClose={onClose} title="نقل لمجموعة أخرى">
      <div className="flex flex-col gap-4">
        {!groups && <p className="text-center text-sm text-zinc-500">جاري تحميل المجموعات...</p>}

        {groups && groups.length === 0 && (
          <p className="text-center text-sm text-zinc-500">لا توجد مجموعات أخرى متاحة لهذا الصف</p>
        )}

        {groups && groups.length > 0 && (
          <div className="flex flex-col gap-2">
            {groups.map((g) => {
              const isFull = g.remaining_seats <= 0;
              const isSelected = selected === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={isFull}
                  onClick={() => setSelected(g.id)}
                  className={`rounded-lg border-2 px-3 py-3 text-right text-sm transition-colors ${
                    isFull
                      ? "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-60"
                      : isSelected
                        ? "border-blue-600 bg-blue-50"
                        : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900">{g.name}</span>
                    {isFull ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        مكتملة
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        {g.remaining_seats} مقعد متاح
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {g.days} — {g.time}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            إلغاء
          </Button>
          <Button type="button" disabled={!selected || submitting} onClick={handleConfirm} className="flex-1">
            {submitting ? "جاري النقل..." : "تأكيد النقل"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
