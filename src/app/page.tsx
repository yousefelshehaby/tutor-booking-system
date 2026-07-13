import Link from "next/link";

const ROLES = [
  {
    href: "/students",
    label: "طالب",
    description: "احجز أو ادفع اشتراكك الشهري",
  },
  {
    href: "/admin/login",
    label: "مدرّس",
    description: "تسجيل الدخول لإدارة الحجوزات والمجموعات",
  },
  {
    href: "/admin/login",
    label: "مساعد",
    description: "تسجيل الدخول لعرض الطلاب وإضافة الملاحظات",
  },
];

export default function RootPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16" dir="rtl">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-zinc-900">أهلًا بيك</h1>
        <p className="mt-3 text-zinc-600">هتدخل النظام بصفتك إيه؟</p>

        <div className="mt-8 flex flex-col gap-3">
          {ROLES.map((role) => (
            <Link
              key={role.label}
              href={role.href}
              className="rounded-xl border-2 border-zinc-200 bg-white px-6 py-4 text-right transition-colors hover:border-blue-600"
            >
              <span className="block text-lg font-semibold text-zinc-900">{role.label}</span>
              <span className="block text-sm text-zinc-500">{role.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
