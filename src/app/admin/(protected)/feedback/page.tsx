import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { getFeedbackMessages } from "@/app/admin/(protected)/feedback/actions";
import { FeedbackTable } from "@/components/admin/FeedbackTable";

export default async function AdminFeedbackPage() {
  const { isSuperAdmin } = await getCurrentAdmin();
  if (!isSuperAdmin) {
    redirect("/admin/dashboard");
  }

  const messages = await getFeedbackMessages();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">الاقتراحات والشكاوى</h1>
      <FeedbackTable messages={messages} />
    </div>
  );
}
