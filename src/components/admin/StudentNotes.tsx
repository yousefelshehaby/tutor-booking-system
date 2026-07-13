"use client";

import { useEffect, useState } from "react";
import { addStudentNote, getNotesForBooking, type StudentNote } from "@/app/admin/(protected)/bookings/actions";

export function StudentNotes({ tutorId, bookingId }: { tutorId: string; bookingId: string }) {
  const [notes, setNotes] = useState<StudentNote[] | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNotesForBooking(bookingId).then(setNotes);
  }, [bookingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await addStudentNote(tutorId, bookingId, text);

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setText("");
    getNotesForBooking(bookingId).then(setNotes);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-zinc-50 p-3" dir="rtl">
      {notes === null && <p className="text-xs text-zinc-500">جاري التحميل...</p>}
      {notes && notes.length === 0 && <p className="text-xs text-zinc-500">لا توجد ملاحظات بعد</p>}
      {notes && notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-zinc-200 bg-white p-2 text-sm">
              <p className="text-zinc-800">{n.note}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {n.author_email ?? "غير معروف"} — {new Date(n.created_at).toLocaleString("ar-EG")}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="أضف ملاحظة..."
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          إضافة
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
