"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createTutor, toggleTutorActive, switchActiveTutor } from "@/app/admin/(protected)/tutors/actions";

export interface AdminTutor {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  is_active: boolean;
}

const EMPTY_FORM = { name: "", slug: "", phone: "", adminEmail: "", adminPassword: "" };

export function TutorsManager({
  tutors,
  activeTutorId,
}: {
  tutors: AdminTutor[];
  activeTutorId: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createTutor(form);

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setForm(EMPTY_FORM);
    router.refresh();
  }

  async function handleToggle(id: string, isActive: boolean) {
    await toggleTutorActive(id, !isActive);
    router.refresh();
  }

  async function handleSwitch(id: string) {
    await switchActiveTutor(id);
  }

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Field label="اسم المدرّس">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="الرابط (بالإنجليزي)">
          <input
            required
            placeholder="mr-ahmed"
            dir="ltr"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="رقم الهاتف (اختياري)">
          <input
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="بريد دخول المدرّس">
          <input
            type="email"
            required
            dir="ltr"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="كلمة المرور">
          <input
            type="text"
            required
            dir="ltr"
            value={form.adminPassword}
            onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <div className="sm:col-span-2 lg:col-span-5">
          <Button type="submit" disabled={submitting}>
            {submitting ? "جاري الإنشاء..." : "إضافة مدرّس"}
          </Button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[700px] text-right text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">الرابط</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {tutors.map((tutor) => (
              <tr key={tutor.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">
                  <Link href={`/admin/tutors/${tutor.id}`} className="font-medium text-zinc-900 hover:underline">
                    {tutor.name}
                  </Link>
                  {tutor.id === activeTutorId && (
                    <span className="mr-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      تديره الآن
                    </span>
                  )}
                </td>
                <td className="px-4 py-3" dir="ltr">
                  /{tutor.slug}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      tutor.is_active ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {tutor.is_active ? "مفعّل" : "معطّل"}
                  </span>
                </td>
                <td className="flex gap-3 px-4 py-3">
                  <button
                    onClick={() => handleSwitch(tutor.id)}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    إدارة هذا المدرّس
                  </button>
                  <button
                    onClick={() => handleToggle(tutor.id, tutor.is_active)}
                    className="font-medium text-zinc-600 hover:underline"
                  >
                    {tutor.is_active ? "تعطيل" : "تفعيل"}
                  </button>
                </td>
              </tr>
            ))}
            {tutors.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  لا يوجد مدرّسون بعد
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
