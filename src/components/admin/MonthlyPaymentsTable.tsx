"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markMonthlyPaymentPaid } from "@/app/admin/(protected)/monthly-payments/actions";
import type { TutorOption } from "@/components/admin/GradesManager";

export interface MatrixRow {
  booking_id: string;
  booking_code: string;
  student_name: string;
  student_phone: string;
  tutor_id: string;
  tutor_name: string;
  grade_id: string;
  grade_name: string;
  group_id: string;
  group_name: string;
  amount: number;
  is_paid: boolean;
  monthly_payment_id: string | null;
}

interface GradeOption {
  id: string;
  name: string;
  tutor_id: string;
}

interface GroupOption {
  id: string;
  name: string;
  grade_id: string;
  tutor_id: string;
}

interface Filters {
  tutor: string;
  grade: string;
  group: string;
  q: string;
}

export function MonthlyPaymentsTable({
  rows,
  grades,
  groups,
  tutors,
  month,
  isSuperAdmin,
  filters,
}: {
  rows: MatrixRow[];
  grades: GradeOption[];
  groups: GroupOption[];
  tutors: TutorOption[];
  month: string;
  isSuperAdmin: boolean;
  filters: Filters;
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q);

  function updateParams(next: Partial<Filters & { month: string }>) {
    const params = new URLSearchParams({
      month,
      tutor: filters.tutor,
      grade: filters.grade,
      group: filters.group,
      q: filters.q,
      ...next,
    });

    for (const key of Array.from(params.keys())) {
      if (!params.get(key)) params.delete(key);
    }

    router.push(`/admin/monthly-payments?${params.toString()}`);
  }

  async function handleMarkPaid(row: MatrixRow) {
    if (!confirm(`تأكيد تسجيل شهر ${month} كمدفوع لـ ${row.student_name}؟`)) return;
    await markMonthlyPaymentPaid({
      monthlyPaymentId: row.monthly_payment_id,
      bookingId: row.booking_id,
      month,
      amount: row.amount,
    });
    router.refresh();
  }

  const filteredGroups = filters.grade ? groups.filter((g) => g.grade_id === filters.grade) : groups;
  const totalCollected = rows.filter((r) => r.is_paid).reduce((sum, r) => sum + Number(r.amount), 0);
  const colCount = isSuperAdmin ? 6 : 5;

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">الشهر</label>
          <input
            type="month"
            value={month}
            onChange={(e) => updateParams({ month: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        {isSuperAdmin && (
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">المدرّس</label>
            <select
              value={filters.tutor}
              onChange={(e) => updateParams({ tutor: e.target.value, grade: "", group: "" })}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">الكل</option>
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">الصف الدراسي</label>
          <select
            value={filters.grade}
            onChange={(e) => updateParams({ grade: e.target.value, group: "" })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">الكل</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">المجموعة</label>
          <select
            value={filters.group}
            onChange={(e) => updateParams({ group: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">الكل</option>
            {filteredGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700">بحث</label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateParams({ q });
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="الاسم، الهاتف، كود الحجز"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm text-zinc-500">
          إجمالي التحصيل هذا الشهر: <span className="font-semibold text-zinc-900">{totalCollected} جنيه</span>{" "}
          — {rows.filter((r) => r.is_paid).length} من {rows.length} طالب دفعوا
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[800px] text-right text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              {isSuperAdmin && <th className="px-4 py-3 font-medium">المدرّس</th>}
              <th className="px-4 py-3 font-medium">الطالب</th>
              <th className="px-4 py-3 font-medium">الصف / المجموعة</th>
              <th className="px-4 py-3 font-medium">المبلغ</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.booking_id} className="border-t border-zinc-100">
                {isSuperAdmin && <td className="px-4 py-3">{row.tutor_name}</td>}
                <td className="px-4 py-3">
                  <div>{row.student_name}</div>
                  <div className="text-xs text-zinc-500" dir="ltr">
                    {row.student_phone}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{row.grade_name}</div>
                  <div className="text-xs text-zinc-500">{row.group_name}</div>
                </td>
                <td className="px-4 py-3">{row.amount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      row.is_paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {row.is_paid ? "مدفوع" : "غير مدفوع"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {!row.is_paid && (
                    <button
                      onClick={() => handleMarkPaid(row)}
                      className="font-medium text-green-700 hover:underline"
                    >
                      تحديد كمدفوع
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-zinc-500">
                  لا يوجد طلاب مسجلين
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
