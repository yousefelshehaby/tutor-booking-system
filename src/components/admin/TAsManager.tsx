"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createTa, setTaActive, updateTaTutorLinks } from "@/app/admin/(protected)/tas/actions";
import { resetAdminPassword } from "@/app/admin/(protected)/tutors/actions";
import type { TutorOption } from "@/components/admin/GradesManager";

export interface AdminTa {
  id: string;
  email: string | null;
  is_active: boolean;
  active_tutor_id: string;
  linked_tutors: { tutor_id: string; tutor_name: string }[];
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
  const [selectedTutorIds, setSelectedTutorIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [editingLinksId, setEditingLinksId] = useState<string | null>(null);
  const [editingTutorIds, setEditingTutorIds] = useState<string[]>([]);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [savingLinks, setSavingLinks] = useState(false);

  function toggleSelected(tutorId: string) {
    setSelectedTutorIds((prev) =>
      prev.includes(tutorId) ? prev.filter((id) => id !== tutorId) : [...prev, tutorId]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createTa({ email, password, tutorIds: selectedTutorIds });

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setEmail("");
    setPassword("");
    setSelectedTutorIds([]);
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

  function startEditingLinks(ta: AdminTa) {
    setEditingLinksId(ta.id);
    setEditingTutorIds(ta.linked_tutors.map((t) => t.tutor_id));
    setLinksError(null);
  }

  function toggleEditingTutor(tutorId: string) {
    setEditingTutorIds((prev) =>
      prev.includes(tutorId) ? prev.filter((id) => id !== tutorId) : [...prev, tutorId]
    );
  }

  async function handleSaveLinks(taId: string) {
    setSavingLinks(true);
    setLinksError(null);

    const result = await updateTaTutorLinks(taId, editingTutorIds);

    setSavingLinks(false);
    if ("error" in result) {
      setLinksError(result.error);
      return;
    }

    setEditingLinksId(null);
    router.refresh();
  }

  const colCount = isSuperAdmin ? 4 : 3;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {canCreate && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              المدرّسون (يمكن اختيار أكثر من مدرّس واحد)
            </label>
            <div className="flex flex-wrap gap-2">
              {tutors.map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm ${
                    selectedTutorIds.includes(t.id)
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-zinc-200 text-zinc-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTutorIds.includes(t.id)}
                    onChange={() => toggleSelected(t.id)}
                    className="sr-only"
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </div>

          <div>
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
              {isSuperAdmin && <th className="px-4 py-3 font-medium">المدرّسون</th>}
              <th className="px-4 py-3 font-medium">البريد الإلكتروني</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {tas.map((ta) => (
              <tr key={ta.id} className="border-t border-zinc-100">
                {isSuperAdmin && (
                  <td className="px-4 py-3">
                    {editingLinksId === ta.id ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          {tutors.map((t) => (
                            <label
                              key={t.id}
                              className={`flex cursor-pointer items-center gap-1 rounded-lg border-2 px-2 py-1 text-xs ${
                                editingTutorIds.includes(t.id)
                                  ? "border-blue-600 bg-blue-50 text-blue-700"
                                  : "border-zinc-200 text-zinc-600"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={editingTutorIds.includes(t.id)}
                                onChange={() => toggleEditingTutor(t.id)}
                                className="sr-only"
                              />
                              {t.name}
                            </label>
                          ))}
                        </div>
                        {linksError && <p className="text-xs text-red-600">{linksError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveLinks(ta.id)}
                            disabled={savingLinks}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            حفظ
                          </button>
                          <button
                            onClick={() => setEditingLinksId(null)}
                            className="text-xs text-zinc-500 hover:underline"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          {ta.linked_tutors.map((t) => t.tutor_name).join("، ") || "لا يوجد"}
                          {ta.linked_tutors.length > 1 && (
                            <span className="mr-1 text-xs text-zinc-500">
                              (يعمل الآن مع:{" "}
                              {ta.linked_tutors.find((t) => t.tutor_id === ta.active_tutor_id)?.tutor_name ??
                                "-"}
                              )
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => startEditingLinks(ta)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          تعديل
                        </button>
                      </div>
                    )}
                  </td>
                )}
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
