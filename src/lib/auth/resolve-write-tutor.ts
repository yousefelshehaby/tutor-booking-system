import "server-only";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/auth/current-admin";

/**
 * Resolves which tutor_id a write (grade/group/TA creation, etc.) should
 * use. A super_admin must explicitly pick a tutor (the UI shows a
 * dropdown) — a tutor always writes to their own tutor_id regardless of
 * what the client sends. A ta can never write here at all.
 */
export async function resolveWriteTutorId(
  inputTutorId?: string | null
): Promise<{ tutorId: string; admin: CurrentAdmin } | { error: string }> {
  const admin = await getCurrentAdmin();

  if (admin.role === "ta") {
    return { error: "هذا الحساب للقراءة فقط" };
  }

  if (admin.role === "super_admin") {
    if (!inputTutorId) return { error: "من فضلك اختر المدرّس" };
    return { tutorId: inputTutorId, admin };
  }

  if (admin.role === "tutor" && admin.tutorId) {
    return { tutorId: admin.tutorId, admin };
  }

  return { error: "هذا الحساب غير مرتبط بمدرّس" };
}
