import Link from "next/link";
import { getBookingByCode } from "@/lib/booking/get-booking";
import { getMonthlyPaymentById } from "@/lib/monthly/get-monthly-payment";
import { RetryPaymentButton } from "@/components/booking/RetryPaymentButton";
import { formatMonth } from "@/lib/utils/format-month";

// Paymob appends its own query params to this URL after a card/wallet
// payment attempt (configured as the integration's redirection URL in the
// Paymob dashboard). We only use `merchant_order_id` to look up the record
// — the authoritative payment_status always comes from our database, which
// is only ever updated by the verified webhook, never by this page.
//
// merchant_order_id is either a booking_code ("BK-...", the initial
// reservation payment) or "MP-<monthly_payments.id>" (a monthly fee
// payment) — these map to different tables, so we branch on the prefix.
export default async function PaymentResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ tutorSlug: string }>;
  searchParams: Promise<{ merchant_order_id?: string }>;
}) {
  const { tutorSlug } = await params;
  const { merchant_order_id: merchantOrderId } = await searchParams;

  if (merchantOrderId?.startsWith("MP-")) {
    const monthlyPayment = await getMonthlyPaymentById(merchantOrderId.slice("MP-".length));

    if (!monthlyPayment) {
      return <NotFound tutorSlug={tutorSlug} />;
    }

    return (
      <main className="flex flex-1 flex-col items-center px-6 py-10" dir="rtl">
        <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          {monthlyPayment.payment_status === "paid" ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">
                ✓
              </div>
              <h1 className="mt-4 text-xl font-bold text-zinc-900">تم دفع الاشتراك بنجاح</h1>
              <p className="mt-2 text-sm text-zinc-600">
                {formatMonth(monthlyPayment.month)} — {monthlyPayment.student_name}
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-3xl">
                !
              </div>
              <h1 className="mt-4 text-xl font-bold text-zinc-900">لم تكتمل عملية الدفع</h1>
              <p className="mt-2 text-sm text-zinc-600">
                {formatMonth(monthlyPayment.month)} — يمكنك المحاولة مرة أخرى من نفس الصفحة
              </p>
            </>
          )}

          <Link
            href={`/${tutorSlug}`}
            className="mt-6 inline-block font-medium text-blue-600 hover:underline"
          >
            العودة للصفحة الرئيسية
          </Link>
        </div>
      </main>
    );
  }

  const booking = merchantOrderId ? await getBookingByCode(merchantOrderId) : null;

  if (!booking) {
    return <NotFound tutorSlug={tutorSlug} />;
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        {booking.payment_status === "paid" ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">
              ✓
            </div>
            <h1 className="mt-4 text-xl font-bold text-zinc-900">تم الدفع بنجاح</h1>
            <p className="mt-2 text-sm text-zinc-600">كود الحجز: {booking.booking_code}</p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-3xl">
              !
            </div>
            <h1 className="mt-4 text-xl font-bold text-zinc-900">لم تكتمل عملية الدفع</h1>
            <p className="mt-2 text-sm text-zinc-600">
              كود الحجز: {booking.booking_code} — يمكنك المحاولة مرة أخرى
            </p>
            <RetryPaymentButton tutorSlug={tutorSlug} bookingCode={booking.booking_code} />
          </>
        )}

        <Link
          href={`/${tutorSlug}/booking/${booking.booking_code}`}
          className="mt-6 inline-block font-medium text-blue-600 hover:underline"
        >
          عرض تفاصيل الحجز
        </Link>
      </div>
    </main>
  );
}

function NotFound({ tutorSlug }: { tutorSlug: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-zinc-600">تعذر العثور على تفاصيل هذه العملية</p>
      <Link href={`/${tutorSlug}`} className="mt-4 font-medium text-blue-600 hover:underline">
        العودة للصفحة الرئيسية
      </Link>
    </main>
  );
}
