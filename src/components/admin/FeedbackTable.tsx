"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  markFeedbackRead,
  deleteFeedbackMessage,
  type FeedbackMessageRow,
} from "@/app/admin/(protected)/feedback/actions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ar-EG");
}

export function FeedbackTable({ messages }: { messages: FeedbackMessageRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleMarkRead(id: string) {
    setBusyId(id);
    await markFeedbackRead(id);
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("تأكيد حذف هذه الرسالة نهائيًا؟")) return;
    setBusyId(id);
    await deleteFeedbackMessage(id);
    setBusyId(null);
    router.refresh();
  }

  if (messages.length === 0) {
    return <p className="text-center text-zinc-500">لا توجد رسائل حاليًا</p>;
  }

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`rounded-xl border p-4 ${
            m.status === "new" ? "border-blue-300 bg-blue-50" : "border-zinc-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="whitespace-pre-wrap text-sm text-zinc-900">{m.message_text}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span>{formatDate(m.created_at)}</span>
                <span>{m.tutor_name ? `صفحة ${m.tutor_name}` : "الصفحة الرئيسية"}</span>
                {m.sender_name && <span>الاسم: {m.sender_name}</span>}
                {m.sender_phone && <span dir="ltr">الهاتف: {m.sender_phone}</span>}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                m.status === "new" ? "bg-blue-100 text-blue-700" : "bg-zinc-200 text-zinc-600"
              }`}
            >
              {m.status === "new" ? "جديدة" : "مقروءة"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 border-t border-zinc-100 pt-3">
            {m.status === "new" && (
              <button
                type="button"
                disabled={busyId === m.id}
                onClick={() => handleMarkRead(m.id)}
                className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                تحديد كمقروءة
              </button>
            )}
            <button
              type="button"
              disabled={busyId === m.id}
              onClick={() => handleDelete(m.id)}
              className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              حذف
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
