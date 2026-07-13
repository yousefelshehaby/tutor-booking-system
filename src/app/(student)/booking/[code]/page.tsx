import Link from "next/link";
import { getBookingByCode } from "@/lib/booking/get-booking";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "بطاقة بنكية",
  wallet: "محفظة إلكترونية",
  fawry: "فوري",
  reserve_only: "حجز بدون دفع الآن",
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "في انتظار الدفع", className: "bg-yellow-100 text-yellow-800" },
  paid: { label: "تم الدفع", className: "bg-green-100 text-green-800" },
  expired: { label: "انتهى الحجز", className: "bg-red-100 text-red-800" },
  cancelled: { label: "ملغي", className: "bg-zinc-200 text-zinc-700" },
};

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const booking = await getBookingByCode(code);

  if (!booking) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-lg font-semibold text-zinc-900">لم يتم العثور على هذا الحجز</p>
        <p className="mt-2 text-zinc-600">من فضلك تأكد من كود الحجز وحاول مرة أخرى</p>
        <Link href="/" className="mt-6 font-medium text-blue-600 hover:underline">
          العودة للصفحة الرئيسية
        </Link>
      </main>
    );
  }

  const statusInfo = PAYMENT_STATUS_LABELS[booking.payment_status];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-900">تفاصيل الحجز</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusInfo.className}`}>
            {statusInfo.label}
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
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              سيتم تفعيل الدفع الإلكتروني قريبًا. تم تسجيل حجزك بحالة &quot;في انتظار
              الدفع&quot;.
            </p>
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
