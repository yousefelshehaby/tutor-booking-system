import { LoginForm } from "@/components/admin/LoginForm";

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <h1 className="mb-8 text-2xl font-bold text-zinc-900">لوحة تحكم الأدمن</h1>
      <LoginForm />
    </main>
  );
}
