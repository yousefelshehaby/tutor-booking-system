"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createTa, setTaActive } from "@/app/admin/(protected)/tas/actions";
import { resetAdminPassword } from "@/app/admin/(protected)/tutors/actions";
import type { TutorOption } from "@/components/admin/GradesManager";

export interface AdminTa {
  id: string;
  email: string | null;
  is_active: boolean;
  tutor_id: string;
  tutor_name: string;
}

export function TAsManager({
  tas,
  canCreate,
  isSuperAdmin,
  tutors,
}: {
  tas: AdminTa[];
  canCreate: boolean;
  isSuperAdmin: boolean;
  tutors: TutorOption[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createTa({ email, password, tutorId });

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setEmail("");
    setPassword("");
    setTutorId("");
    router.refresh();
  }

  async function handleToggle(id: string, isActive: boolean) {
    await setTaActive(id, !isActive);
    router.refresh();
  }

  async function handleResetPassword(id: string) {
    if (newPassword.length < 8) {
      alert("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }
    const result = await resetAdminPassword(id, newPassword);
    if ("error" in result) {
      alert(result.error);
    } else {
      alert("تم تغيير كلمة المرور بنجاح");
      setResettingId(null);
      setNewPassword("");
    }
  }

  const colCount = isSuperAdmin ? 4 : 3;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {canCreate && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-4"
        >
          {isSuperAdmin && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">المدرّس</label>
              <select
                required
                value={tutorId}
                onChange={(e) => setTutorId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">اختر...</option>
                {tutors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
          <div>
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
          <div className="flex items-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? "جاري الإنشاء..." : "إضافة مساعد"}
            </Button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[600px] text-right text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              {isSuperAdmin && <th className="px-4 py-3 font-medium">المدرّس</th>}
              <th className="px-4 py-3 font-medium">البريد الإلكتروني</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {tas.map((ta) => (
              <tr key={ta.id} className="border-t border-zinc-100">
                {isSuperAdmin && <td className="px-4 py-3">{ta.tutor_name}</td>}
                <td className="px-4 py-3" dir="ltr">
                  {ta.email}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      ta.is_active ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {ta.is_active ? "مفعّل" : "معطّل"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleToggle(ta.id, ta.is_active)}
                      className="font-medium text-zinc-600 hover:underline"
                    >
                      {ta.is_active ? "تعطيل" : "تفعيل"}
                    </button>
                    {canCreate &&
                      (resettingId === ta.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="كلمة مرور جديدة"
                            dir="ltr"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => handleResetPassword(ta.id)}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            حفظ
                          </button>
                          <button
                            onClick={() => setResettingId(null)}
                            className="text-zinc-500 hover:underline"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setResettingId(ta.id);
                            setNewPassword("");
                          }}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          إعادة تعيين كلمة المرور
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
            {tas.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-zinc-500">
                  لا يوجد مساعدون بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
