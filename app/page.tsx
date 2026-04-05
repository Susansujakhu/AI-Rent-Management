export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentMonth, formatCurrency, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-green-100 text-green-800",
    PARTIAL: "bg-blue-100 text-blue-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    OVERDUE: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}

export default async function DashboardPage() {
  const month = currentMonth();
  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  // Delete stale future PENDING bills (beyond current month)
  await prisma.payment.deleteMany({
    where: { status: "PENDING", month: { gt: month } },
  });

  // Mark overdue payments
  await prisma.payment.updateMany({
    where: {
      status: "PENDING",
      month: { lt: month },
    },
    data: { status: "OVERDUE" },
  });

  // Backfill missing payment months — up to 12 months back, or move-in if more recent
  const activeTenants = await prisma.tenant.findMany({
    where: { moveOutDate: null, roomId: { not: null } },
    include: { room: { include: { recurringCharges: true } } },
  });

  function toMonthStr(year: number, m: number) {
    return `${year}-${String(m).padStart(2, "0")}`;
  }

  // 12-month lookback window
  const lookbackDate = new Date();
  lookbackDate.setMonth(lookbackDate.getMonth() - 11);
  const lookbackMonth = toMonthStr(lookbackDate.getFullYear(), lookbackDate.getMonth() + 1);

  for (const tenant of activeTenants) {
    if (!tenant.roomId || !tenant.room) continue;

    const moveInMonth = toMonthStr(
      tenant.moveInDate.getFullYear(),
      tenant.moveInDate.getMonth() + 1
    );
    // Start from whichever is more recent: move-in or 12-month lookback
    const startMonth = moveInMonth > lookbackMonth ? moveInMonth : lookbackMonth;
    // Build list of months from startMonth to current
    const allMonths: string[] = [];
    const [sy, sm] = startMonth.split("-").map(Number);
    const [ey, em] = month.split("-").map(Number);
    let y = sy, mo = sm;
    while (y < ey || (y === ey && mo <= em)) {
      allMonths.push(toMonthStr(y, mo));
      mo++; if (mo > 12) { mo = 1; y++; }
    }

    for (const m2 of allMonths) {
      const isPast = m2 < month;
      const amountDue = tenant.room.monthlyRent + tenant.room.recurringCharges
        .filter((c) =>
          (c.tenantId === null || c.tenantId === tenant.id) &&
          (!c.effectiveFrom || c.effectiveFrom <= m2)
        )
        .reduce((s, c) => s + c.amount, 0);

      const existing = await prisma.payment.findUnique({
        where: { tenantId_month: { tenantId: tenant.id, month: m2 } },
        select: { id: true, status: true },
      });

      if (!existing) {
        await prisma.payment.create({
          data: { tenantId: tenant.id, roomId: tenant.roomId, month: m2, amountDue, amountPaid: 0, status: isPast ? "OVERDUE" : "PENDING" },
        });
      } else if (existing.status !== "PAID") {
        await prisma.payment.update({ where: { id: existing.id }, data: { amountDue } });
      }
    }
  }

  // Fetch stats
  const [mo, yr] = [Number(month.split("-")[1]), Number(month.split("-")[0])];
  const [totalRooms, activeTenantCount, currentMonthPayments, overdueCount, currentMonthOneTime] = await Promise.all([
    prisma.room.count(),
    prisma.tenant.count({ where: { moveOutDate: null } }),
    prisma.payment.findMany({
      where: { month },
      include: { tenant: true, room: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.count({ where: { status: "OVERDUE" } }),
    prisma.oneTimeCharge.findMany({
      where: { date: { gte: new Date(yr, mo - 1, 1), lt: new Date(yr, mo, 1) } },
    }),
  ]);

  const collectedThisMonth = currentMonthPayments.reduce((sum, p) => sum + p.amountPaid, 0)
    + currentMonthOneTime.reduce((sum, c) => sum + c.amountPaid, 0);

  const overduePayments = await prisma.payment.findMany({
    where: { status: "OVERDUE" },
    include: { tenant: true, room: true },
    take: 5,
    orderBy: { month: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{formatMonth(month)}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Rooms</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalRooms}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active Tenants</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{activeTenantCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Collected This Month</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{fmt(collectedThisMonth)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pending / Overdue</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{overdueCount}</p>
        </div>
      </div>

      {/* Overdue Alert */}
      {overduePayments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-red-800 mb-2">
            Overdue Payments ({overduePayments.length})
          </h2>
          <div className="space-y-1">
            {overduePayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-red-700">
                  {p.tenant.name} — {p.room.name} ({p.month})
                </span>
                <span className="font-medium text-red-800">{fmt(p.amountDue - p.amountPaid)}</span>
              </div>
            ))}
          </div>
          <Link href="/payments" className="text-xs text-red-600 underline mt-2 inline-block">
            View all payments →
          </Link>
        </div>
      )}

      {/* Current Month Payments */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            {formatMonth(month)} — Rent Collection
          </h2>
          <Link
            href="/payments"
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>
        {currentMonthPayments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No payments for this month.{" "}
            <Link href="/payments" className="text-blue-600 underline">
              Generate bills
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {currentMonthPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.tenant.name}</p>
                  <p className="text-xs text-gray-500">{p.room.name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {fmt(p.amountPaid)} / {fmt(p.amountDue)}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                  {p.status !== "PAID" && (
                    <Link
                      href={`/payments/${p.id}/pay`}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    >
                      Pay
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/rooms/new"
          className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <p className="text-sm font-medium text-gray-700">Add Room</p>
        </Link>
        <Link
          href="/tenants/new"
          className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <p className="text-sm font-medium text-gray-700">Add Tenant</p>
        </Link>
        <Link
          href="/payments"
          className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <p className="text-sm font-medium text-gray-700">Record Payment</p>
        </Link>
        <Link
          href="/expenses/new"
          className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <p className="text-sm font-medium text-gray-700">Add Expense</p>
        </Link>
      </div>
    </div>
  );
}
