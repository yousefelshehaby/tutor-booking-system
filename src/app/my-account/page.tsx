import { MyAccountView } from "@/components/my-account/MyAccountView";

export default function MyAccountPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6 sm:py-10" dir="rtl">
      <div className="w-full max-w-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-zinc-900">حسابي</h1>
        <MyAccountView />
      </div>
    </main>
  );
}
