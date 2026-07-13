import { redirect } from "next/navigation";
import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { TAsManager, type AdminTa } from "@/components/admin/TAsManager";

interface AdminUserRow {
  id: string;
  email: string | null;
  is_active: boolean;
  tutor_id: string;
}

interface LinkRow {
  ta_id: string;
  tutor_id: string;
  tutors: { name: string } | { name: string }[] | null;
}

export default async function AdminTasPage() {
  const { role, tutorId, isSuperAdmin } = await getCurrentAdmin();
  if (role !== "tutor" && role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  if (!isSuperAdmin && !tutorId) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-zinc-900">المساعدون</h1>
        <p className="text-zinc-500">هذا الحساب غير مرتبط بمدرّس</p>
      </div>
    );
  }

  const supabase = await createAdminServerClient();

  let linksQuery = supabase.from("ta_tutor_links").select("ta_id, tutor_id, tutors(name)");
  if (!isSuperAdmin) {
    linksQuery = linksQuery.eq("tutor_id", tutorId as string);
  }

  const [{ data: linkRows }, { data: tutors }] = await Promise.all([
    linksQuery,
    isSuperAdmin
      ? supabase.from("tutors").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const taIds = Array.from(new Set((linkRows ?? []).map((r) => r.ta_id)));
  if (taIds.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-zinc-900">المساعدون</h1>
        <TAsManager tas={[]} canCreate={isSuperAdmin} isSuperAdmin={isSuperAdmin} tutors={tutors ?? []} />
      </div>
    );
  }

  // For super admin, load EVERY link for these TAs (not just the ones
  // matching the query filter above, which is a no-op for super admin
  // anyway) so the "linked tutors" list shown/edited is always complete.
  const { data: allLinksForTheseTas } = await supabase
    .from("ta_tutor_links")
    .select("ta_id, tutor_id, tutors(name)")
    .in("ta_id", taIds);

  const { data: adminUserRows } = await supabase
    .from("admin_users")
    .select("id, email, is_active, tutor_id")
    .in("id", taIds)
    .eq("role", "ta")
    .order("email");

  const linksByTa = new Map<string, { tutor_id: string; tutor_name: string }[]>();
  for (const row of (allLinksForTheseTas ?? []) as LinkRow[]) {
    const tutorInfo = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    const list = linksByTa.get(row.ta_id) ?? [];
    list.push({ tutor_id: row.tutor_id, tutor_name: tutorInfo?.name ?? "غير معروف" });
    linksByTa.set(row.ta_id, list);
  }

  const tas: AdminTa[] = ((adminUserRows ?? []) as AdminUserRow[]).map((row) => {
    const links = linksByTa.get(row.id) ?? [];
    return {
      id: row.id,
      email: row.email,
      is_active: row.is_active,
      active_tutor_id: row.tutor_id,
      linked_tutors: links,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">المساعدون</h1>
      <TAsManager tas={tas} canCreate={isSuperAdmin} isSuperAdmin={isSuperAdmin} tutors={tutors ?? []} />
    </div>
  );
}
