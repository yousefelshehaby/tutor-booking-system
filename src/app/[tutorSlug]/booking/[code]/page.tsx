import Link from "next/link";
import { getBookingByCode } from "@/lib/booking/get-booking";
import { RetryPaymentButton } from "@/components/booking/RetryPaymentButton";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/booking/labels";

const STATUS_CLASSNAMES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
  cancelled: "bg-zinc-200 text-zinc-700",
};

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ tutorSlug: string; code: string }>;
}) {
  const { tutorSlug, code } = await params;
  const booking = await getBookingByCode(code);

  if (!booking) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-lg font-semibold text-zinc-900">لم يتم العثور على هذا الحجز</p>
        <p className="mt-2 text-zinc-600">من فضلك تأكد من كود الحجز وحاول مرة أخرى</p>
        <Link href={`/${tutorSlug}`} className="mt-6 font-medium text-blue-600 hover:underline">
          العودة للصفحة الرئيسية
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-900">تفاصيل الحجز</h1>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_CLASSNAMES[booking.payment_status]}`}
          >
            {PAYMENT_STATUS_LABELS[booking.payment_status]}
          </span>
        </div>

        <div className="mt-6 rounded-xl bg-zinc-50 p-4 text-center">
          <p className="text-sm text-zinc-500">كود الحجز</p>
          <p className="mt-1 text-2xl font-bold tracking-wide text-blue-700">
            {booking.booking_code}
          </p>
        </div>

        <dl className="mt-6 flex flex-col gap-3 text-sm">
          <Row label="اسم الطالب" value={booking.student_name} />
          <Row label="الصف الدراسي" value={booking.grade_name} />
          <Row label="المجموعة" value={booking.group_name} />
          <Row label="المواعيد" value={`${booking.group_days} — ${booking.group_time}`} />
          <Row label="طريقة الدفع" value={PAYMENT_METHOD_LABELS[booking.payment_method]} />
          <Row label="المبلغ" value={`${booking.amount} جنيه`} />
        </dl>

        {booking.payment_method === "reserve_only" && booking.expires_at && (
          <div className="mt-6 rounded-xl border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-sm font-semibold text-yellow-800">
              تنبيه: يجب إتمام الدفع قبل{" "}
              {new Date(booking.expires_at).toLocaleString("ar-EG")} وإلا سيتم إلغاء الحجز
              تلقائيًا.
            </p>
          </div>
        )}

        {booking.payment_method !== "reserve_only" && booking.payment_status === "pending" && (
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
            <p className="text-sm text-blue-800">لم يتم إتمام الدفع بعد لهذا الحجز.</p>
            <RetryPaymentButton tutorSlug={tutorSlug} bookingCode={booking.booking_code} />
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
