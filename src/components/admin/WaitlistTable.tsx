"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { promoteWaitlistEntry, removeWaitlistEntry, type WaitlistRow } from "@/app/admin/(protected)/waitlist/actions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

export function WaitlistTable({ entries, readOnly = false }: { entries: WaitlistRow[]; readOnly?: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [promoted, setPromoted] = useState<Record<string, string>>({});

  async function handlePromote(id: string) {
    setBusyId(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));

    const result = await promoteWaitlistEntry(id);

    setBusyId(null);
    if ("error" in result) {
      setErrors((prev) => ({ ...prev, [id]: result.error }));
      return;
    }

    setPromoted((prev) => ({ ...prev, [id]: result.bookingCode }));
    router.refresh();
  }

  async function handleRemove(id: string) {
    setBusyId(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));

    const result = await removeWaitlistEntry(id);

    setBusyId(null);
    if ("error" in result) {
      setErrors((prev) => ({ ...prev, [id]: result.error }));
      return;
    }

    router.refresh();
  }

  if (entries.length === 0) {
    return <p className="text-center text-zinc-500">لا يوجد أحد في قائمة الانتظار حاليًا</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-3 text-right font-semibold text-zinc-600">الطالب</th>
            <th className="px-4 py-3 text-right font-semibold text-zinc-600">رقم الهاتف</th>
            <th className="px-4 py-3 text-right font-semibold text-zinc-600">المجموعة</th>
            <th className="px-4 py-3 text-right font-semibold text-zinc-600">تاريخ الطلب</th>
            {!readOnly && <th className="px-4 py-3 text-right font-semibold text-zinc-600">إجراءات</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-3 font-medium text-zinc-900">{entry.student_name}</td>
              <td className="px-4 py-3 text-zinc-600" dir="ltr">
                {entry.student_phone}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {entry.grade_name} — {entry.group_name}
              </td>
              <td className="px-4 py-3 text-zinc-500">{formatDate(entry.created_at)}</td>
              {!readOnly && (
                <td className="px-4 py-3">
                  {promoted[entry.id] ? (
                    <span className="font-medium text-green-700">
                      تم التحويل لحجز ({promoted[entry.id]})
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busyId === entry.id}
                        onClick={() => handlePromote(entry.id)}
                        className="font-medium text-blue-600 hover:underline disabled:opacity-50"
                      >
                        تحويل لحجز
                      </button>
                      <button
                        type="button"
                        disabled={busyId === entry.id}
                        onClick={() => handleRemove(entry.id)}
                        className="font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        إزالة
                      </button>
                    </div>
                  )}
                  {errors[entry.id] && <p className="mt-1 text-xs text-red-600">{errors[entry.id]}</p>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
