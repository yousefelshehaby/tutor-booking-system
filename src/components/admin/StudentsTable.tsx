"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  markBookingPaid,
  cancelBooking,
  archiveBooking,
  restoreBooking,
} from "@/app/admin/(protected)/bookings/actions";
import { getMonthlyStripForBooking, type MonthlyStripItem } from "@/app/admin/(protected)/students/actions";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/booking/labels";
import { StudentNotes } from "@/components/admin/StudentNotes";
import { formatMonth } from "@/lib/utils/format-month";
import type { TutorOption } from "@/components/admin/GradesManager";

export interface AdminStudent {
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
  group_days: string;
  group_time: string;
  tutor_id: string;
  tutor_name: string;
  archived_at: string | null;
  archived_by_name: string | null;
  previousArchivedBooking: { booking_code: string; archived_at: string } | null;
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

export function StudentsTable({
  students,
  grades,
  groups,
  tutors,
  totalCount,
  pageSize,
  currentPage,
  filters,
  isSuperAdmin,
  readOnly = false,
  archivedMode = false,
}: {
  students: AdminStudent[];
  grades: GradeOption[];
  groups: GroupOption[];
  tutors: TutorOption[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  filters: Filters;
  isSuperAdmin: boolean;
  readOnly?: boolean;
  archivedMode?: boolean;
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
      ...(archivedMode ? { archived: "1" } : {}),
      ...next,
    });

    for (const key of Array.from(params.keys())) {
      if (!params.get(key)) params.delete(key);
    }

    router.push(`/admin/students?${params.toString()}`);
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

  async function handleArchive(id: string) {
    if (
      !confirm(
        "تأكيد حذف هذا الطالب؟ سيختفي من كل القوائم، لكن هيتم الاحتفاظ بسجله بالكامل (المدفوعات والملاحظات) ويقدر يتم استعادته لاحقًا."
      )
    )
      return;
    await archiveBooking(id);
    router.refresh();
  }

  async function handleRestore(id: string) {
    if (!confirm("تأكيد استعادة هذا الطالب؟")) return;
    const result = await restoreBooking(id);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  const filteredGroups = filters.grade ? groups.filter((g) => g.grade_id === filters.grade) : groups;

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {!readOnly && (
        <div className="flex gap-2">
          <Link
            href="/admin/students"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              !archivedMode ? "bg-blue-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            الطلاب
          </Link>
          <Link
            href="/admin/students?archived=1"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              archivedMode ? "bg-blue-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            الأرشيف
          </Link>
        </div>
      )}

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

        {!archivedMode && (
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
        )}

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

      <div className="flex flex-col gap-3">
        {students.map((student) => (
          <StudentRow
            key={student.id}
            student={student}
            isExpanded={expandedId === student.id}
            onToggle={() => setExpandedId(expandedId === student.id ? null : student.id)}
            isSuperAdmin={isSuperAdmin}
            readOnly={readOnly}
            archivedMode={archivedMode}
            onMarkPaid={() => handleMarkPaid(student.id)}
            onCancel={() => handleCancel(student.id)}
            onArchive={() => handleArchive(student.id)}
            onRestore={() => handleRestore(student.id)}
          />
        ))}

        {students.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-zinc-500">
            {archivedMode ? "لا يوجد طلاب محذوفون" : "لا يوجد طلاب مطابقون"}
          </div>
        )}
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

function StudentRow({
  student,
  isExpanded,
  onToggle,
  isSuperAdmin,
  readOnly,
  archivedMode,
  onMarkPaid,
  onCancel,
  onArchive,
  onRestore,
}: {
  student: AdminStudent;
  isExpanded: boolean;
  onToggle: () => void;
  isSuperAdmin: boolean;
  readOnly: boolean;
  archivedMode: boolean;
  onMarkPaid: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const [strip, setStrip] = useState<MonthlyStripItem[] | null>(null);

  function handleToggle() {
    onToggle();
    if (!isExpanded && strip === null && student.payment_status === "paid") {
      getMonthlyStripForBooking(student.id).then(setStrip);
    }
  }

  return (
    <Fragment>
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <button type="button" onClick={handleToggle} className="flex w-full items-center justify-between text-right">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-zinc-900">{student.student_name}</p>
              {!archivedMode && student.previousArchivedBooking && (
                <Link
                  href={`/admin/students?archived=1&q=${encodeURIComponent(student.previousArchivedBooking.booking_code)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 hover:underline"
                >
                  طالب سابق
                </Link>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500" dir="ltr">
              {student.student_phone}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {student.grade_name} — {student.group_name}
              {isSuperAdmin && ` — ${student.tutor_name}`}
            </p>
          </div>
          {archivedMode ? (
            <span className="shrink-0 text-left text-xs text-zinc-500">
              {student.archived_at && (
                <>
                  حُذف بتاريخ {new Date(student.archived_at).toLocaleDateString("ar-EG")}
                  {student.archived_by_name && (
                    <>
                      <br />
                      بواسطة {student.archived_by_name}
                    </>
                  )}
                </>
              )}
            </span>
          ) : (
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASSNAMES[student.payment_status]}`}
            >
              {PAYMENT_STATUS_LABELS[student.payment_status]}
            </span>
          )}
        </button>

        {isExpanded && (
          <div className="mt-4 flex flex-col gap-4 border-t border-zinc-100 pt-4 text-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Row label="كود الحجز" value={student.booking_code} />
              <Row label="رقم ولي الأمر" value={student.guardian_phone} />
              <Row label="المواعيد" value={`${student.group_days} — ${student.group_time}`} />
              <Row label="طريقة الدفع" value={PAYMENT_METHOD_LABELS[student.payment_method]} />
              <Row label="المبلغ" value={`${student.amount} جنيه`} />
              <Row label="تاريخ الحجز" value={new Date(student.created_at).toLocaleDateString("ar-EG")} />
            </div>

            {student.payment_status === "paid" && (
              <div>
                <p className="mb-2 font-medium text-zinc-700">الاشتراك الشهري</p>
                {strip === null ? (
                  <p className="text-xs text-zinc-500">جاري التحميل...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {strip.map((m) => (
                      <span
                        key={m.month}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          m.is_paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {formatMonth(m.month)} {m.is_paid ? "✓" : "✗"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!readOnly && (
              <div className="flex flex-wrap gap-3">
                {archivedMode ? (
                  <button onClick={onRestore} className="font-medium text-blue-600 hover:underline">
                    استعادة
                  </button>
                ) : (
                  <>
                    {(student.payment_status === "pending" || student.payment_status === "expired") && (
                      <>
                        <button onClick={onMarkPaid} className="font-medium text-green-700 hover:underline">
                          تحديد كمدفوع
                        </button>
                        <button onClick={onCancel} className="font-medium text-red-600 hover:underline">
                          إلغاء الحجز
                        </button>
                      </>
                    )}
                    <button onClick={onArchive} className="font-medium text-red-600 hover:underline">
                      حذف الطالب
                    </button>
                  </>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 font-medium text-zinc-700">الملاحظات</p>
              <StudentNotes tutorId={student.tutor_id} bookingId={student.id} />
            </div>
          </div>
        )}
      </div>
    </Fragment>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-50 pb-1">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-900">{value}</span>
    </div>
  );
}
