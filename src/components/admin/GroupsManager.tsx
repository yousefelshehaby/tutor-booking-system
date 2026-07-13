"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  createGroup,
  deleteGroup,
  toggleGroupActive,
  updateGroup,
} from "@/app/admin/(protected)/groups/actions";
import type { AdminGrade, TutorOption } from "@/components/admin/GradesManager";

export interface AdminGroup {
  id: string;
  grade_id: string;
  name: string;
  days: string;
  time: string;
  capacity: number;
  price: number;
  monthly_fee: number | null;
  is_active: boolean;
  grade_name: string;
  tutor_id: string;
  tutor_name: string;
}

interface FormState {
  grade_id: string;
  name: string;
  days: string;
  time: string;
  capacity: string;
  price: string;
  monthly_fee: string;
  tutorId: string;
}

const EMPTY_FORM: FormState = {
  grade_id: "",
  name: "",
  days: "",
  time: "",
  capacity: "",
  price: "",
  monthly_fee: "",
  tutorId: "",
};

export function GroupsManager({
  groups,
  grades,
  isSuperAdmin,
  tutors,
}: {
  groups: AdminGroup[];
  grades: AdminGrade[];
  isSuperAdmin: boolean;
  tutors: TutorOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const createGrades = isSuperAdmin ? grades.filter((g) => g.tutor_id === form.tutorId) : grades;
  const editGrades = isSuperAdmin ? grades.filter((g) => g.tutor_id === editForm.tutorId) : grades;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createGroup({
      ...form,
      monthly_fee: form.monthly_fee.trim() === "" ? null : form.monthly_fee,
      tutorId: isSuperAdmin ? form.tutorId : undefined,
    });

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setForm(EMPTY_FORM);
    router.refresh();
  }

  function startEdit(group: AdminGroup) {
    setEditingId(group.id);
    setEditForm({
      grade_id: group.grade_id,
      name: group.name,
      days: group.days,
      time: group.time,
      capacity: String(group.capacity),
      price: String(group.price),
      monthly_fee: group.monthly_fee === null ? "" : String(group.monthly_fee),
      tutorId: group.tutor_id,
    });
  }

  async function handleUpdate(id: string) {
    const result = await updateGroup(id, {
      ...editForm,
      monthly_fee: editForm.monthly_fee.trim() === "" ? null : editForm.monthly_fee,
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
    await toggleGroupActive(id, !isActive);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذه المجموعة؟")) return;
    const result = await deleteGroup(id);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  const colCount = isSuperAdmin ? 10 : 9;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        {isSuperAdmin && (
          <Field label="المدرّس">
            <select
              required
              value={form.tutorId}
              onChange={(e) => setForm({ ...form, tutorId: e.target.value, grade_id: "" })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">اختر...</option>
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="الصف الدراسي">
          <select
            required
            value={form.grade_id}
            onChange={(e) => setForm({ ...form, grade_id: e.target.value })}
            disabled={isSuperAdmin && !form.tutorId}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">اختر...</option>
            {createGrades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="اسم المجموعة">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="الأيام">
          <input
            required
            placeholder="السبت والثلاثاء"
            value={form.days}
            onChange={(e) => setForm({ ...form, days: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="الموعد">
          <input
            required
            placeholder="4:00 مساءً"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="السعة">
          <input
            type="number"
            required
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="السعر">
          <input
            type="number"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="الاشتراك الشهري (اختياري)">
          <input
            type="number"
            placeholder="مثل السعر إن ترك فارغًا"
            value={form.monthly_fee}
            onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <div className="sm:col-span-2 lg:col-span-6">
          <Button type="submit" disabled={submitting}>
            إضافة مجموعة
          </Button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[900px] text-right text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              {isSuperAdmin && <th className="px-4 py-3 font-medium">المدرّس</th>}
              <th className="px-4 py-3 font-medium">الصف</th>
              <th className="px-4 py-3 font-medium">المجموعة</th>
              <th className="px-4 py-3 font-medium">الأيام</th>
              <th className="px-4 py-3 font-medium">الموعد</th>
              <th className="px-4 py-3 font-medium">السعة</th>
              <th className="px-4 py-3 font-medium">السعر</th>
              <th className="px-4 py-3 font-medium">الاشتراك الشهري</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) =>
              editingId === group.id ? (
                <tr key={group.id} className="border-t border-zinc-100">
                  {isSuperAdmin && (
                    <td className="px-4 py-3">
                      <select
                        value={editForm.tutorId}
                        onChange={(e) =>
                          setEditForm({ ...editForm, tutorId: e.target.value, grade_id: "" })
                        }
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
                    <select
                      value={editForm.grade_id}
                      onChange={(e) => setEditForm({ ...editForm, grade_id: e.target.value })}
                      className="rounded-lg border border-zinc-300 px-2 py-1"
                    >
                      {editGrades.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={editForm.days}
                      onChange={(e) => setEditForm({ ...editForm, days: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={editForm.time}
                      onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={editForm.capacity}
                      onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                      className="w-16 rounded-lg border border-zinc-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="w-20 rounded-lg border border-zinc-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={editForm.monthly_fee}
                      onChange={(e) => setEditForm({ ...editForm, monthly_fee: e.target.value })}
                      className="w-20 rounded-lg border border-zinc-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">—</td>
                  <td className="flex gap-2 px-4 py-3">
                    <button
                      onClick={() => handleUpdate(group.id)}
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
                </tr>
              ) : (
                <tr key={group.id} className="border-t border-zinc-100">
                  {isSuperAdmin && <td className="px-4 py-3">{group.tutor_name}</td>}
                  <td className="px-4 py-3">{group.grade_name}</td>
                  <td className="px-4 py-3">{group.name}</td>
                  <td className="px-4 py-3">{group.days}</td>
                  <td className="px-4 py-3">{group.time}</td>
                  <td className="px-4 py-3">{group.capacity}</td>
                  <td className="px-4 py-3">{group.price}</td>
                  <td className="px-4 py-3">{group.monthly_fee ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        group.is_active ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {group.is_active ? "مفعّلة" : "غير مفعّلة"}
                    </span>
                  </td>
                  <td className="flex gap-3 px-4 py-3">
                    <button
                      onClick={() => startEdit(group)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleToggle(group.id, group.is_active)}
                      className="font-medium text-zinc-600 hover:underline"
                    >
                      {group.is_active ? "تعطيل" : "تفعيل"}
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              )
            )}
            {groups.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-zinc-500">
                  لا توجد مجموعات بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  );
}
