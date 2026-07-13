import Link from "next/link";

export default async function FawryReferencePage({
  params,
  searchParams,
}: {
  params: Promise<{ tutorSlug: string }>;
  searchParams: Promise<{ code?: string; ref?: string }>;
}) {
  const { tutorSlug } = await params;
  const { code, ref } = await searchParams;

  if (!code || !ref) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-zinc-600">بيانات الدفع غير مكتملة</p>
        <Link href={`/${tutorSlug}`} className="mt-4 font-medium text-blue-600 hover:underline">
          العودة للصفحة الرئيسية
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">كود الدفع في فوري</h1>
        <p className="mt-2 text-sm text-zinc-600">
          توجه لأقرب فرع فوري وادفع باستخدام الكود التالي قبل انتهاء صلاحيته
        </p>

        <div className="mt-6 rounded-xl bg-zinc-50 p-6">
          <p className="text-sm text-zinc-500">كود الدفع</p>
          <p className="mt-1 text-3xl font-bold tracking-widest text-blue-700" dir="ltr">
            {ref}
          </p>
        </div>

        <p className="mt-6 text-sm text-zinc-500">كود الحجز: {code}</p>

        <Link
          href={`/${tutorSlug}/booking/${code}`}
          className="mt-6 inline-block font-medium text-blue-600 hover:underline"
        >
          متابعة حالة الحجز
        </Link>
      </div>
    </main>
  );
}
