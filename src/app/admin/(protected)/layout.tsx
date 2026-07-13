import Link from "next/link";
import { signOut } from "@/lib/auth/admin-actions";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { NotificationsBell } from "@/components/admin/NotificationsBell";
import { TaTutorSwitcher } from "@/components/admin/TaTutorSwitcher";

const FULL_NAV_LINKS = [
  { href: "/admin/dashboard", label: "لوحة القيادة" },
  { href: "/admin/grades", label: "الصفوف الدراسية" },
  { href: "/admin/groups", label: "المجموعات" },
  { href: "/admin/bookings", label: "الحجوزات" },
  { href: "/admin/monthly-payments", label: "المدفوعات الشهرية" },
  { href: "/admin/settings", label: "الإعدادات" },
  { href: "/admin/tas", label: "المساعدون" },
];

const TA_NAV_LINKS = [{ href: "/admin/bookings", label: "الحجوزات" }];

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const { id, role, isSuperAdmin, isTa, tutorId } = await getCurrentAdmin();

  let activeTutorName: string | null = null;
  let taLinks: { tutor_id: string; tutor_name: string }[] = [];

  if (tutorId) {
    const supabase = await createAdminServerClient();
    const { data } = await supabase.from("tutors").select("name").eq("id", tutorId).maybeSingle();
    activeTutorName = data?.name ?? null;

    if (isTa && id) {
      const { data: linkRows } = await supabase
        .from("ta_tutor_links")
        .select("tutor_id, tutors(name)")
        .eq("ta_id", id);

      taLinks = (linkRows ?? []).map((row) => {
        const tutorInfo = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
        return { tutor_id: row.tutor_id, tutor_name: tutorInfo?.name ?? "غير معروف" };
      });
    }
  }

  const navLinks = isTa
    ? TA_NAV_LINKS
    : isSuperAdmin
      ? [...FULL_NAV_LINKS, { href: "/admin/tutors", label: "المدرّسون" }]
      : FULL_NAV_LINKS;

  return (
    <div className="flex min-h-screen flex-1 flex-col" dir="rtl">
      <header className="border-b border-zinc-200 bg-white">
        {isSuperAdmin && activeTutorName && (
          <div className="bg-blue-50 px-6 py-1.5 text-center text-xs font-medium text-blue-700">
            أنت الآن تدير: {activeTutorName}
          </div>
        )}
        {isTa && tutorId && taLinks.length > 1 && (
          <TaTutorSwitcher links={taLinks} activeTutorId={tutorId} />
        )}
        {isTa && tutorId && taLinks.length <= 1 && activeTutorName && (
          <div className="bg-blue-50 px-6 py-1.5 text-center text-xs font-medium text-blue-700">
            تعمل الآن مع: {activeTutorName}
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
          <div className="flex items-center gap-2">
            {(role === "tutor" || isSuperAdmin) && <NotificationsBell />}
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                تسجيل الخروج
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
