import Link from "next/link";
import { FeedbackButton } from "@/components/tutor/FeedbackButton";

export function AdminFooterLink({ tutorId = null }: { tutorId?: string | null }) {
  return (
    <footer className="flex flex-col items-center gap-2 py-6 text-center">
      <Link href="/admin/login" className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline">
        دخول المدرّسين والمساعدين
      </Link>
      <FeedbackButton tutorId={tutorId} />
    </footer>
  );
}
