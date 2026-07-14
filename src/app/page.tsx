import Link from "next/link";
import Image from "next/image";
import { createAnonServerClient } from "@/lib/supabase/server";
import { AdminFooterLink } from "@/components/tutor/AdminFooterLink";

interface TutorListing {
  id: string;
  name: string;
  slug: string;
  photo_url: string | null;
}

// Next.js statically prerendered this page at build time (no dynamic
// params, no obviously-dynamic data source) — a fresh build's snapshot
// of the tutor directory then kept being served indefinitely, never
// reflecting tutors added/removed afterward. The directory must always
// reflect live data.
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("list_active_tutors");
  const tutors = (data ?? []) as TutorListing[];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex justify-end px-6 pt-4" dir="rtl">
        <Link href="/my-account" className="text-sm font-medium text-blue-600 hover:underline">
          حسابي
        </Link>
      </div>
      <main className="flex flex-1 flex-col items-center px-6 py-16" dir="rtl">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-zinc-900">اختر مدرّسك</h1>
          <p className="mt-3 text-zinc-600">اختر اسم المدرّس اللي عايز تحجز أو تدفع اشتراكه</p>

          <div className="mt-8 flex flex-col gap-3">
            {tutors.map((tutor) => (
              <Link
                key={tutor.id}
                href={`/${tutor.slug}`}
                className="flex items-center gap-3 rounded-xl border-2 border-zinc-200 bg-white px-6 py-4 text-lg font-semibold text-zinc-900 transition-colors hover:border-blue-600 hover:text-blue-700"
              >
                {tutor.photo_url ? (
                  <Image
                    src={tutor.photo_url}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-sm text-zinc-400">
                    {tutor.name.charAt(0)}
                  </span>
                )}
                {tutor.name}
              </Link>
            ))}

            {tutors.length === 0 && <p className="text-zinc-500">لا يوجد مدرّسون متاحون حاليًا</p>}
          </div>
        </div>
      </main>
      <AdminFooterLink />
    </div>
  );
}
