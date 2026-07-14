import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { StudentsTable } from "@/components/admin/StudentsTable";
import { DashboardGreeting } from "@/components/admin/DashboardGreeting";
import { fetchAdminBookings } from "@/lib/admin/fetch-bookings";

const PAGE_SIZE = 20;

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tutor?: string;
    grade?: string;
    group?: string;
    status?: string;
    q?: string;
    page?: string;
    archived?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const archivedMode = params.archived === "1";

  const { isTa, isSuperAdmin, name } = await getCurrentAdmin();

  const { bookings, gradeOptions, groupOptions, tutors, totalCount } = await fetchAdminBookings(
    { ...params, page, pageSize: PAGE_SIZE },
    { isSuperAdmin, archived: archivedMode && !isTa }
  );

  return (
    <div className="flex flex-col gap-6">
      {isTa && name && <DashboardGreeting greeting={`أهلاً بيك ${name}`} subtitle="طلابي" />}
      {!(isTa && name) && <h1 className="text-2xl font-bold text-zinc-900">طلابي</h1>}
      <StudentsTable
        students={bookings}
        grades={gradeOptions}
        groups={groupOptions}
        tutors={tutors}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        currentPage={page}
        filters={{
          tutor: params.tutor ?? "",
          grade: params.grade ?? "",
          group: params.group ?? "",
          status: params.status ?? "",
          q: params.q ?? "",
        }}
        isSuperAdmin={isSuperAdmin}
        readOnly={isTa}
        archivedMode={archivedMode && !isTa}
      />
    </div>
  );
}
