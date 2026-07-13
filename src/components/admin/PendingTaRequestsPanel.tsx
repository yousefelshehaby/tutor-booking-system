"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { approveTaRequest, rejectTaRequest } from "@/app/admin/(protected)/tas/requests-actions";
import type { TutorOption } from "@/components/admin/GradesManager";

export interface PendingTaRequest {
  id: string;
  tutor_id: string;
  tutor_name: string;
  ta_name: string;
  ta_email: string;
  ta_phone: string | null;
  tutor_note: string | null;
  created_at: string;
}

export function PendingTaRequestsPanel({
  requests,
  tutors,
}: {
  requests: PendingTaRequest[];
  tutors: TutorOption[];
}) {
  const router = useRouter();

  if (requests.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4" dir="rtl">
      <h2 className="font-semibold text-zinc-900">
        طلبات مساعدين معلّقة ({requests.length})
      </h2>
      <div className="flex flex-col gap-3">
        {requests.map((r) => (
          <RequestRow key={r.id} request={r} tutors={tutors} onResolved={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}

function RequestRow({
  request,
  tutors,
  onResolved,
}: {
  request: PendingTaRequest;
  tutors: TutorOption[];
  onResolved: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [name, setName] = useState(request.ta_name);
  const [email, setEmail] = useState(request.ta_email);
  const [password, setPassword] = useState("");
  const [tutorIds, setTutorIds] = useState<string[]>([request.tutor_id]);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleTutor(tutorId: string) {
    setTutorIds((prev) =>
      prev.includes(tutorId) ? prev.filter((id) => id !== tutorId) : [...prev, tutorId]
    );
  }

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await approveTaRequest(request.id, { name, email, password, tutorIds });

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    onResolved();
  }

  async function handleReject() {
    setSubmitting(true);
    setError(null);

    const result = await rejectTaRequest(request.id, rejectNote || undefined);

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    onResolved();
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-zinc-900">
            {request.ta_name} <span className="text-zinc-400" dir="ltr">({request.ta_email})</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            طلب من: {request.tutor_name}
            {request.ta_phone && <span dir="ltr"> — {request.ta_phone}</span>}
          </p>
          {request.tutor_note && (
            <p className="mt-1 text-xs text-zinc-600">ملاحظة المدرّس: {request.tutor_note}</p>
          )}
        </div>

        {mode === "idle" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("approve")}
              className="font-medium text-green-700 hover:underline"
            >
              قبول
            </button>
            <button
              type="button"
              onClick={() => setMode("reject")}
              className="font-medium text-red-600 hover:underline"
            >
              رفض
            </button>
          </div>
        )}
      </div>

      {mode === "approve" && (
        <form onSubmit={handleApprove} className="mt-3 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">اسم المساعد</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">البريد الإلكتروني</label>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">كلمة المرور</label>
            <input
              type="text"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              المدرّسون (يمكن اختيار أكثر من مدرّس واحد)
            </label>
            <div className="flex flex-wrap gap-2">
              {tutors.map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm ${
                    tutorIds.includes(t.id)
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-zinc-200 text-zinc-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tutorIds.includes(t.id)}
                    onChange={() => toggleTutor(t.id)}
                    className="sr-only"
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "جاري الإنشاء..." : "تأكيد الموافقة وإنشاء الحساب"}
            </Button>
            <button type="button" onClick={() => setMode("idle")} className="text-sm text-zinc-500 hover:underline">
              إلغاء
            </button>
          </div>
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        </form>
      )}

      {mode === "reject" && (
        <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3">
          <label className="text-sm font-medium text-zinc-700">سبب الرفض (اختياري، هيظهر للمدرّس)</label>
          <input
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" disabled={submitting} onClick={handleReject}>
              {submitting ? "جاري الرفض..." : "تأكيد الرفض"}
            </Button>
            <button type="button" onClick={() => setMode("idle")} className="text-sm text-zinc-500 hover:underline">
              إلغاء
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
