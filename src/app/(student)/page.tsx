import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
          احجز مكانك في الدروس الخصوصية
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600">
          اختر الصف الدراسي والمجموعة المناسبة لك، وادفع أونلاين بسهولة وأمان.
        </p>

        <Link
          href="/book"
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          احجز الآن
        </Link>
      </div>
    </main>
  );
}
