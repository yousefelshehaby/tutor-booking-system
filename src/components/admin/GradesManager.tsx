"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createGrade, deleteGrade, toggleGradeActive, updateGrade } from "@/app/admin/(protected)/grades/actions";
import type { Grade } from "@/types/booking";

export function GradesManager({ grades }: { grades: Grade[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOrder, setEditOrder] = useState("0");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createGrade({ name, display_order: displayOrder });

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setName("");
    setDisplayOrder("0");
    router.refresh();
  }

  function startEdit(grade: Grade) {
    setEditingId(grade.id);
    setEditName(grade.name);
    setEditOrder(String(grade.display_order));
  }

  async function handleUpdate(id: string) {
    const result = await updateGrade(id, { name: editName, display_order: editOrder });
    if (!result.error) {
      setEditingId(null);
      router.refresh();
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
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700">اسم الصف الدراسي</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-sm font-medium text-zinc-700">الترتيب</label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" disabled={submitting}>
          إضافة
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-right text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">الاسم</th>
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
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={editOrder}
                        onChange={(e) => setEditOrder(e.target.value)}
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
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
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
