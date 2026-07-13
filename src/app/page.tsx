import { redirect } from "next/navigation";

// Placeholder for a future multi-tutor directory. For now the site launches
// with a single tutor, so the bare root just forwards to their page.
export default function RootPage() {
  redirect("/default");
}
