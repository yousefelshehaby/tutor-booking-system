import Link from "next/link";
import { createAnonServerClient } from "@/lib/supabase/server";

interface TutorListing {
  id: string;
  name: string;
  slug: string;
}

export default async function RootPage() {
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("list_active_tutors");
  const tutors = (data ?? []) as TutorListing[];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16" dir="rtl">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-zinc-900">اختر مدرّسك</h1>
        <p className="mt-3 text-zinc-600">اختر اسم المدرّس اللي عايز تحجز أو تدفع اشتراكه</p>

        <div className="mt-8 flex flex-col gap-3">
          {tutors.map((tutor) => (
            <Link
              key={tutor.id}
              href={`/${tutor.slug}`}
              className="rounded-xl border-2 border-zinc-200 bg-white px-6 py-4 text-lg font-semibold text-zinc-900 transition-colors hover:border-blue-600 hover:text-blue-700"
            >
              {tutor.name}
            </Link>
          ))}

          {tutors.length === 0 && <p className="text-zinc-500">لا يوجد مدرّسون متاحون حاليًا</p>}
        </div>
      </div>
    </main>
  );
}
