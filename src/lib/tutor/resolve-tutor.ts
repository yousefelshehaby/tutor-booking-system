import "server-only";
import { notFound } from "next/navigation";
import { createAnonServerClient } from "@/lib/supabase/server";

export interface PublicTutor {
  id: string;
  name: string;
  slug: string;
}

/**
 * Resolves a tutor by slug for public student-facing pages. Only ever
 * returns active tutors (see get_tutor_by_slug RPC) — an invalid or
 * inactive slug renders the Arabic 404 page instead.
 */
export async function resolveTutorOrNotFound(slug: string): Promise<PublicTutor> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .rpc("get_tutor_by_slug", { p_slug: slug })
    .single<PublicTutor>();

  if (error || !data) {
    notFound();
  }

  return data;
}
