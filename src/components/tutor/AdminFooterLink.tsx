import Link from "next/link";

export function AdminFooterLink() {
  return (
    <footer className="py-6 text-center">
      <Link href="/admin/login" className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline">
        دخول المدرّسين والمساعدين
      </Link>
    </footer>
  );
}
