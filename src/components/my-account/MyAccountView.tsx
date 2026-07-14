"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getStudentActivity, type RecentActivityItem, type StudentTutorBooking } from "@/app/my-account/actions";
import { PAYMENT_STATUS_LABELS } from "@/lib/booking/labels";
import { formatMonth } from "@/lib/utils/format-month";

const STATUS_CLASSNAMES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
  cancelled: "bg-zinc-200 text-zinc-700",
};

const ACTIVITY_LABELS: Record<string, string> = {
  booking_created: "تم إنشاء حجز",
  booking_paid: "تم دفع رسوم الحجز",
  monthly_paid: "تم دفع اشتراك",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

export function MyAccountView() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<StudentTutorBooking[] | null>(null);
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await getStudentActivity(phone);

    setLoading(false);
    if (!result.success) {
      setError(result.error);
      setBookings(null);
      return;
    }

    setBookings(result.bookings);
    setActivity(result.activity);
  }

  const byTutor = new Map<string, StudentTutorBooking[]>();
  for (const b of bookings ?? []) {
    const list = byTutor.get(b.tutor_id) ?? [];
    list.push(b);
    byTutor.set(b.tutor_id, list);
  }

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700">رقم الهاتف</label>
        <div className="flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            dir="ltr"
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button type="submit" disabled={loading || !phone.trim()}>
            {loading ? "جاري البحث..." : "بحث"}
          </Button>
        </div>
        <p className="text-xs text-zinc-500">تظهر البيانات المرتبطة برقم الهاتف المدخل</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {bookings && bookings.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold text-zinc-900">المدرّسون</h2>
          {Array.from(byTutor.entries()).map(([tutorId, tutorBookings]) => {
            const first = tutorBookings[0];
            return (
              <div key={tutorId} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  {first.tutor_photo_url ? (
                    <Image
                      src={first.tutor_photo_url}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-lg text-zinc-400">
                      {first.tutor_name.charAt(0)}
                    </span>
                  )}
                  <p className="font-semibold text-zinc-900">{first.tutor_name}</p>
                </div>

                <div className="mt-3 flex flex-col gap-3">
                  {tutorBookings.map((b) => (
                    <div key={b.booking_id} className="rounded-lg border border-zinc-100 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-900">
                          {b.grade_name} — {b.group_name}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASSNAMES[b.payment_status]}`}
                        >
                          {PAYMENT_STATUS_LABELS[b.payment_status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {b.group_days} — {b.group_time}
                      </p>
                      {b.monthlySummary && (
                        <p className="mt-2 text-sm font-medium text-zinc-700">{b.monthlySummary}</p>
                      )}
                    </div>
                  ))}
                </div>

                <Link
                  href={`/${first.tutor_slug}/monthly?phone=${encodeURIComponent(phone)}`}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  عرض كشف الحساب الكامل
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {activity.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-zinc-900">آخر النشاطات</h2>
          <div className="flex flex-col gap-2">
            {activity.map((a, i) => (
              <div key={i} className="rounded-lg border border-zinc-100 bg-white p-3 text-sm">
                <p className="font-medium text-zinc-900">
                  {ACTIVITY_LABELS[a.event_type] ?? a.event_type} — {a.tutor_name}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {a.event_type === "monthly_paid" ? `اشتراك ${formatMonth(a.description)}` : a.description} ·{" "}
                  {formatDate(a.event_date)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
