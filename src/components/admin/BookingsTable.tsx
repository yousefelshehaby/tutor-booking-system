"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { markBookingPaid, cancelBooking } from "@/app/admin/(protected)/bookings/actions";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/booking/labels";
import { StudentNotes } from "@/components/admin/StudentNotes";
import type { TutorOption } from "@/components/admin/GradesManager";

export interface AdminBooking {
  id: string;
  booking_code: string;
  student_name: string;
  student_phone: string;
  guardian_phone: string;
  payment_method: string;
  payment_status: string;
  amount: number;
  created_at: string;
  grade_name: string;
  group_name: string;
  tutor_id: string;
  tutor_name: string;
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
  status: string;
  q: string;
}

const STATUS_CLASSNAMES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
  cancelled: "bg-zinc-200 text-zinc-700",
};

export function BookingsTable({
  bookings,
  grades,
  groups,
  tutors,
  totalCount,
  pageSize,
  currentPage,
  filters,
  isSuperAdmin,
  readOnly = false,
}: {
  bookings: AdminBooking[];
  grades: GradeOption[];
  groups: GroupOption[];
  tutors: TutorOption[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  filters: Filters;
  isSuperAdmin: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function updateParams(next: Partial<Filters & { page: string }>) {
    const params = new URLSearchParams({
      tutor: filters.tutor,
      grade: filters.grade,
      group: filters.group,
      status: filters.status,
      q: filters.q,
      page: "1",
      ...next,
    });

    for (const key of Array.from(params.keys())) {
      if (!params.get(key)) params.delete(key);
    }

    router.push(`/admin/bookings?${params.toString()}`);
  }

  async function handleMarkPaid(id: string) {
    if (!confirm("تأكيد وضع الحجز كمدفوع؟")) return;
    await markBookingPaid(id);
    router.refresh();
  }

  async function handleCancel(id: string) {
    if (!confirm("تأكيد إلغاء هذا الحجز؟")) return;
    await cancelBooking(id);
    router.refresh();
  }

  const filteredGroups = filters.grade ? groups.filter((g) => g.grade_id === filters.grade) : groups;
  const colCount = isSuperAdmin ? 8 : 7;

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4">
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

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">حالة الدفع</label>
          <select
            value={filters.status}
            onChange={(e) => updateParams({ status: e.target.value })}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">الكل</option>
            <option value="pending">في انتظار الدفع</option>
            <option value="paid">تم الدفع</option>
            <option value="expired">انتهى</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
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

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[900px] text-right text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              {isSuperAdmin && <th className="px-4 py-3 font-medium">المدرّس</th>}
              <th className="px-4 py-3 font-medium">كود الحجز</th>
              <th className="px-4 py-3 font-medium">الطالب</th>
              <th className="px-4 py-3 font-medium">الصف / المجموعة</th>
              <th className="px-4 py-3 font-medium">طريقة الدفع</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">المبلغ</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => {
              const isExpanded = expandedId === booking.id;
              return (
                <Fragment key={booking.id}>
                  <tr className="border-t border-zinc-100">
                    {isSuperAdmin && <td className="px-4 py-3">{booking.tutor_name}</td>}
                    <td className="px-4 py-3 font-mono text-xs">{booking.booking_code}</td>
                    <td className="px-4 py-3">
                      <div>{booking.student_name}</div>
                      <div className="text-xs text-zinc-500" dir="ltr">
                        {booking.student_phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{booking.grade_name}</div>
                      <div className="text-xs text-zinc-500">{booking.group_name}</div>
                    </td>
                    <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[booking.payment_method]}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASSNAMES[booking.payment_status]}`}
                      >
                        {PAYMENT_STATUS_LABELS[booking.payment_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{booking.amount}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        {!readOnly &&
                          (booking.payment_status === "pending" || booking.payment_status === "expired") && (
                            <>
                              <button
                                onClick={() => handleMarkPaid(booking.id)}
                                className="font-medium text-green-700 hover:underline"
                              >
                                تحديد كمدفوع
                              </button>
                              <button
                                onClick={() => handleCancel(booking.id)}
                                className="font-medium text-red-600 hover:underline"
                              >
                                إلغاء
                              </button>
                            </>
                          )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {isExpanded ? "إخفاء الملاحظات" : "الملاحظات"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-zinc-100">
                      <td colSpan={colCount} className="px-4 py-3">
                        <StudentNotes tutorId={booking.tutor_id} bookingId={booking.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-zinc-500">
                  لا توجد حجوزات مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => updateParams({ page: String(p) })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                p === currentPage ? "bg-blue-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
