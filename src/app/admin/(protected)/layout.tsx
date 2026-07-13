import Link from "next/link";
import { signOut } from "@/lib/auth/admin-actions";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { createAdminServerClient } from "@/lib/supabase/admin-server";

const NAV_LINKS = [
  { href: "/admin/dashboard", label: "لوحة القيادة" },
  { href: "/admin/grades", label: "الصفوف الدراسية" },
  { href: "/admin/groups", label: "المجموعات" },
  { href: "/admin/bookings", label: "الحجوزات" },
  { href: "/admin/monthly-payments", label: "المدفوعات الشهرية" },
  { href: "/admin/settings", label: "الإعدادات" },
];

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, tutorId } = await getCurrentAdmin();

  let activeTutorName: string | null = null;
  if (tutorId) {
    const supabase = await createAdminServerClient();
    const { data } = await supabase.from("tutors").select("name").eq("id", tutorId).maybeSingle();
    activeTutorName = data?.name ?? null;
  }

  const navLinks = isSuperAdmin
    ? [...NAV_LINKS, { href: "/admin/tutors", label: "المدرّسون" }]
    : NAV_LINKS;

  return (
    <div className="flex min-h-screen flex-1 flex-col" dir="rtl">
      <header className="border-b border-zinc-200 bg-white">
        {isSuperAdmin && activeTutorName && (
          <div className="bg-blue-50 px-6 py-1.5 text-center text-xs font-medium text-blue-700">
            أنت الآن تدير: {activeTutorName}
          </div>
        )}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <nav className="flex flex-wrap gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              تسجيل الخروج
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
