import { createAdminServerClient } from "@/lib/supabase/admin-server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { formatMonth } from "@/lib/utils/format-month";

interface GroupJoin {
  name: string | null;
}

interface BookingRow {
  group_id: string;
  payment_status: string;
  groups: GroupJoin | GroupJoin[] | null;
}

export default async function AdminDashboardPage() {
  const supabase = await createAdminServerClient();
  await supabase.rpc("expire_stale_reservations");
  const { tutorId } = await getCurrentAdmin();

  const [
    { count: paidCount },
    { count: pendingCount },
    { data: paidAmounts },
    { data: activeBookings },
    { data: settings },
  ] = await Promise.all([
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("payment_status", "paid"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("payment_status", "pending"),
    supabase.from("bookings").select("amount").eq("payment_status", "paid"),
    supabase
      .from("bookings")
      .select("group_id, payment_status, groups(name)")
      .in("payment_status", ["paid", "pending"]),
    tutorId
      ? supabase.from("settings").select("current_month").eq("tutor_id", tutorId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const totalRevenue = (paidAmounts ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  const currentMonth = settings?.current_month ?? null;
  let monthlyCollected = 0;
  let monthlyPaidCount = 0;
  if (currentMonth) {
    const { data: monthlyRows } = await supabase
      .from("monthly_payments")
      .select("amount, payment_status")
      .eq("month", currentMonth);
    for (const row of monthlyRows ?? []) {
      if (row.payment_status === "paid") {
        monthlyCollected += Number(row.amount);
        monthlyPaidCount += 1;
      }
    }
  }

  const perGroup = new Map<string, { name: string; count: number }>();
  for (const row of (activeBookings ?? []) as BookingRow[]) {
    const groupInfo = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    const name = groupInfo?.name ?? "غير معروف";
    const entry = perGroup.get(row.group_id) ?? { name, count: 0 };
    entry.count += 1;
    perGroup.set(row.group_id, entry);
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-zinc-900">لوحة القيادة</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="عدد الطلاب الذين دفعوا" value={String(paidCount ?? 0)} />
        <StatCard label="إجمالي الإيرادات" value={`${totalRevenue.toLocaleString("ar-EG")} جنيه`} />
        <StatCard label="حجوزات في انتظار الدفع" value={String(pendingCount ?? 0)} />
      </div>

      {currentMonth && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">
            تحصيل شهر {formatMonth(currentMonth)}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard
              label="المبلغ المحصّل هذا الشهر"
              value={`${monthlyCollected.toLocaleString("ar-EG")} جنيه`}
            />
            <StatCard
              label="عدد الطلاب الذين دفعوا"
              value={`${monthlyPaidCount} من ${paidCount ?? 0}`}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">عدد الحجوزات لكل مجموعة</h2>
        {perGroup.size === 0 ? (
          <p className="text-zinc-500">لا توجد حجوزات حتى الآن</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-right text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">المجموعة</th>
                  <th className="px-4 py-3 font-medium">عدد الحجوزات</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(perGroup.values()).map((entry) => (
                  <tr key={entry.name} className="border-t border-zinc-100">
                    <td className="px-4 py-3">{entry.name}</td>
                    <td className="px-4 py-3">{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}
