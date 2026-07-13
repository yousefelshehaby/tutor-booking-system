"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createGrade, deleteGrade, toggleGradeActive, updateGrade } from "@/app/admin/(protected)/grades/actions";

export interface AdminGrade {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  tutor_id: string;
  tutor_name: string;
}

export interface TutorOption {
  id: string;
  name: string;
}

interface FormState {
  name: string;
  display_order: string;
  tutorId: string;
}

export function GradesManager({
  grades,
  isSuperAdmin,
  tutors,
}: {
  grades: AdminGrade[];
  isSuperAdmin: boolean;
  tutors: TutorOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ name: "", display_order: "0", tutorId: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ name: "", display_order: "0", tutorId: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createGrade({
      name: form.name,
      display_order: form.display_order,
      tutorId: isSuperAdmin ? form.tutorId : undefined,
    });

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setForm({ name: "", display_order: "0", tutorId: "" });
    router.refresh();
  }

  function startEdit(grade: AdminGrade) {
    setEditingId(grade.id);
    setEditForm({ name: grade.name, display_order: String(grade.display_order), tutorId: grade.tutor_id });
  }

  async function handleUpdate(id: string) {
    const result = await updateGrade(id, {
      name: editForm.name,
      display_order: editForm.display_order,
      tutorId: isSuperAdmin ? editForm.tutorId : undefined,
    });
    if (!("error" in result)) {
      setEditingId(null);
      router.refresh();
    } else {
      alert(result.error);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await toggleGradeActive(id, !isActive);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الصف الدراسي؟")) return;
    const result = await deleteGrade(id);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end sm:flex-wrap"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700">اسم الصف الدراسي</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-sm font-medium text-zinc-700">الترتيب</label>
          <input
            type="number"
            value={form.display_order}
            onChange={(e) => setForm({ ...form, display_order: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        {isSuperAdmin && (
          <div className="w-48">
            <label className="mb-1 block text-sm font-medium text-zinc-700">المدرّس</label>
            <select
              required
              value={form.tutorId}
              onChange={(e) => setForm({ ...form, tutorId: e.target.value })}
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
        <Button type="submit" disabled={submitting}>
          إضافة
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-right text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">الاسم</th>
              {isSuperAdmin && <th className="px-4 py-3 font-medium">المدرّس</th>}
              <th className="px-4 py-3 font-medium">الترتيب</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((grade) => (
              <tr key={grade.id} className="border-t border-zinc-100">
                {editingId === grade.id ? (
                  <>
                    <td className="px-4 py-3">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full rounded-lg border border-zinc-300 px-2 py-1"
                      />
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3">
                        <select
                          value={editForm.tutorId}
                          onChange={(e) => setEditForm({ ...editForm, tutorId: e.target.value })}
                          className="rounded-lg border border-zinc-300 px-2 py-1"
                        >
                          {tutors.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={editForm.display_order}
                        onChange={(e) => setEditForm({ ...editForm, display_order: e.target.value })}
                        className="w-20 rounded-lg border border-zinc-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-3 text-zinc-400">—</td>
                    <td className="flex gap-2 px-4 py-3">
                      <button
                        onClick={() => handleUpdate(grade.id)}
                        className="font-medium text-green-700 hover:underline"
                      >
                        حفظ
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="font-medium text-zinc-500 hover:underline"
                      >
                        إلغاء
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">{grade.name}</td>
                    {isSuperAdmin && <td className="px-4 py-3">{grade.tutor_name}</td>}
                    <td className="px-4 py-3">{grade.display_order}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          grade.is_active ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {grade.is_active ? "مفعّل" : "غير مفعّل"}
                      </span>
                    </td>
                    <td className="flex gap-3 px-4 py-3">
                      <button
                        onClick={() => startEdit(grade)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleToggle(grade.id, grade.is_active)}
                        className="font-medium text-zinc-600 hover:underline"
                      >
                        {grade.is_active ? "تعطيل" : "تفعيل"}
                      </button>
                      <button
                        onClick={() => handleDelete(grade.id)}
                        className="font-medium text-red-600 hover:underline"
                      >
                        حذف
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {grades.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 5 : 4} className="px-4 py-6 text-center text-zinc-500">
                  لا توجد صفوف دراسية بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
