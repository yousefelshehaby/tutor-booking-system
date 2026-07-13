"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createTaRequest } from "@/app/admin/(protected)/tas/requests-actions";

export interface TutorTaRequest {
  id: string;
  ta_name: string;
  ta_email: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
};

const STATUS_CLASSNAMES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const EMPTY_FORM = { taName: "", taEmail: "", taPhone: "", tutorNote: "" };

export function TutorTaRequests({ requests }: { requests: TutorTaRequest[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createTaRequest(form);

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setForm(EMPTY_FORM);
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-zinc-900">طلبات إضافة مساعد</h2>
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            طلب مساعد جديد
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">اسم المساعد</label>
            <input
              required
              value={form.taName}
              onChange={(e) => setForm({ ...form, taName: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">البريد الإلكتروني</label>
            <input
              type="email"
              required
              dir="ltr"
              value={form.taEmail}
              onChange={(e) => setForm({ ...form, taEmail: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">رقم الهاتف (اختياري)</label>
            <input
              dir="ltr"
              value={form.taPhone}
              onChange={(e) => setForm({ ...form, taPhone: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">ملاحظة (اختياري)</label>
            <input
              value={form.tutorNote}
              onChange={(e) => setForm({ ...form, tutorNote: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="text-sm text-zinc-500 hover:underline"
            >
              إلغاء
            </button>
          </div>
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        </form>
      )}

      {requests.length > 0 && (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-zinc-100 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-900">
                  {r.ta_name} <span className="text-zinc-400" dir="ltr">({r.ta_email})</span>
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASSNAMES[r.status]}`}
                >
                  {STATUS_LABELS[r.status]}
                </span>
              </div>
              {r.status === "rejected" && r.admin_note && (
                <p className="mt-1 text-xs text-red-600">السبب: {r.admin_note}</p>
              )}
              <p className="mt-1 text-xs text-zinc-400">
                {new Date(r.created_at).toLocaleString("ar-EG")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
