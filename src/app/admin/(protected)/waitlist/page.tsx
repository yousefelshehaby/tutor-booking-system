import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { getWaitlistEntries } from "@/app/admin/(protected)/waitlist/actions";
import { WaitlistTable } from "@/components/admin/WaitlistTable";

export default async function AdminWaitlistPage() {
  const { isTa } = await getCurrentAdmin();
  const entries = await getWaitlistEntries();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">قائمة الانتظار</h1>
      <WaitlistTable entries={entries} readOnly={isTa} />
    </div>
  );
}
