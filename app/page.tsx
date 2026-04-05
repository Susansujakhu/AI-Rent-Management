export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentMonth, formatCurrency, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { Building2, Users, TrendingUp, TrendingDown, AlertTriangle, DoorOpen, CreditCard, Receipt, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { CollectionChart } from "@/components/collection-chart";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID:    "bg-emerald-50 text-emerald-700 border border-emerald-100",
    PARTIAL: "bg-blue-50 text-blue-700 border border-blue-100",
    PENDING: "bg-amber-50 text-amber-700 border border-amber-100",
    OVERDUE: "bg-rose-50 text-rose-700 border border-rose-100",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

// Simple SVG sparkline — works in server components, no JS needed
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 80, H = 32;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / range) * H}`)
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible opacity-80">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function toMonthStr(year: number, m: number) {
  return `${year}-${String(m).padStart(2, "0")}`;
}
function shortMonth(month: string) {
  const [y, m] = month.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en", { month: "short" });
}

export default async function DashboardPage() {
  const { requireAuth } = await import("@/lib/auth");
  await requireAuth();

  const month    = currentMonth();
  const settings = await getSettings();
  const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);
  const now      = new Date();

  // Bill generation & overdue marking
  await prisma.payment.deleteMany({ where: { status: "PENDING", month: { gt: month } } });
  await prisma.payment.updateMany({ where: { status: "PENDING", month: { lt: month } }, data: { status: "OVERDUE" } });

  // Backfill
  const activeTenants = await prisma.tenant.findMany({
    where: { moveOutDate: null, roomId: { not: null } },
    include: { room: { include: { recurringCharges: true } } },
  });
  const lookbackDate = new Date();
  lookbackDate.setMonth(lookbackDate.getMonth() - 11);
  const lookbackMonth = toMonthStr(lookbackDate.getFullYear(), lookbackDate.getMonth() + 1);

  for (const tenant of activeTenants) {
    if (!tenant.roomId || !tenant.room) continue;
    const moveInMonth = toMonthStr(tenant.moveInDate.getFullYear(), tenant.moveInDate.getMonth() + 1);
    const startMonth  = moveInMonth > lookbackMonth ? moveInMonth : lookbackMonth;
    const allMonths: string[] = [];
    const [sy, sm] = startMonth.split("-").map(Number);
    const [ey, em] = month.split("-").map(Number);
    let y = sy, mo = sm;
    while (y < ey || (y === ey && mo <= em)) {
      allMonths.push(toMonthStr(y, mo));
      mo++; if (mo > 12) { mo = 1; y++; }
    }
    for (const m2 of allMonths) {
      const isPast    = m2 < month;
      const amountDue = tenant.room.monthlyRent + tenant.room.recurringCharges
        .filter((c) => (c.tenantId === null || c.tenantId === tenant.id) && (!c.effectiveFrom || c.effectiveFrom <= m2))
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

  // Stats
  const [mo, yr] = [Number(month.split("-")[1]), Number(month.split("-")[0])];
  const [totalRooms, activeTenantCount, currentMonthPayments, overdueCount, currentMonthOneTime] = await Promise.all([
    prisma.room.count(),
    prisma.tenant.count({ where: { moveOutDate: null } }),
    prisma.payment.findMany({ where: { month }, include: { tenant: true, room: true }, orderBy: { createdAt: "desc" } }),
    prisma.payment.count({ where: { status: "OVERDUE" } }),
    prisma.oneTimeCharge.findMany({ where: { date: { gte: new Date(yr, mo - 1, 1), lt: new Date(yr, mo, 1) } } }),
  ]);

  const collectedThisMonth = currentMonthPayments.reduce((s, p) => s + p.amountPaid, 0)
    + currentMonthOneTime.reduce((s, c) => s + c.amountPaid, 0);

  const overduePayments = await prisma.payment.findMany({
    where: { status: "OVERDUE" },
    include: { tenant: true, room: true },
    take: 5,
    orderBy: { month: "desc" },
  });

  // 6-month chart + sparkline data
  const last6: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6.push(toMonthStr(d.getFullYear(), d.getMonth() + 1));
  }
  const chartPayments = await prisma.payment.findMany({
    where: { month: { gte: last6[0], lte: last6[5] } },
  });
  const monthlyCollected = last6.map((m) =>
    chartPayments.filter((p) => p.month === m).reduce((s, p) => s + p.amountPaid, 0)
  );
  const chartData = last6.map((m, i) => ({
    month: shortMonth(m),
    due: chartPayments.filter((p) => p.month === m).reduce((s, p) => s + p.amountDue, 0),
    collected: monthlyCollected[i],
  }));

  // Trend: current vs previous month
  const prevMonthCollected = monthlyCollected[4] ?? 0;
  const trend = prevMonthCollected > 0
    ? Math.round(((collectedThisMonth - prevMonthCollected) / prevMonthCollected) * 100)
    : 0;
  const trendUp = trend >= 0;

  const occupiedRooms = await prisma.room.count({ where: { tenants: { some: { moveOutDate: null } } } });
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // Anniversary — active tenants whose move-in month matches current month
  const anniversaryTenants = activeTenants.filter(t => {
    const m = t.moveInDate.getMonth() + 1;
    return m === Number(month.split("-")[1]);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">{formatMonth(month)}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Rooms */}
        <div className="animate-fade-up stagger-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
              <Building2 size={17} className="text-white" />
            </div>
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{occupancyRate}% full</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalRooms}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Total Rooms</p>
        </div>

        {/* Active Tenants */}
        <div className="animate-fade-up stagger-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm shadow-violet-200">
              <Users size={17} className="text-white" />
            </div>
            <span className="text-xs font-semibold bg-violet-50 text-violet-600 px-2 py-1 rounded-lg">{activeTenantCount} active</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{activeTenantCount}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Active Tenants</p>
        </div>

        {/* Collected — with sparkline + trend */}
        <div className="animate-fade-up stagger-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm shadow-emerald-200">
              <TrendingUp size={17} className="text-white" />
            </div>
            {trend !== 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${trendUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-emerald-600">{fmt(collectedThisMonth)}</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Collected this month</p>
            </div>
            <Sparkline values={monthlyCollected} color="#10b981" />
          </div>
        </div>

        {/* Overdue */}
        <div className="animate-fade-up stagger-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-sm shadow-rose-200">
              <AlertTriangle size={17} className="text-white" />
            </div>
            {overdueCount > 0 && (
              <span className="text-xs font-semibold bg-rose-50 text-rose-600 px-2 py-1 rounded-lg border border-rose-100">
                Action needed
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-rose-600">{overdueCount}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Overdue payments</p>
        </div>
      </div>

      {/* Chart + Overdue Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart */}
        <div className="animate-fade-up stagger-2 lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-900">Collection Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">Rent due vs collected — last 6 months</p>
            </div>
            <Link href="/reports" className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
              Full report <ChevronRight size={12} />
            </Link>
          </div>
          <CollectionChart data={chartData} />
        </div>

        {/* Overdue Panel */}
        <div className="animate-fade-up stagger-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Overdue</h2>
            {overdueCount > 0 && (
              <span className="text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 px-2.5 py-1 rounded-lg">{overdueCount}</span>
            )}
          </div>
          {overduePayments.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={20} className="text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-slate-600">All caught up!</p>
              <p className="text-xs text-slate-400 mt-0.5">No overdue payments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overduePayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{p.tenant.name}</p>
                    <p className="text-xs text-slate-400">{p.room.name} · {p.month}</p>
                  </div>
                  <span className="text-xs font-bold text-rose-600">{fmt(p.amountDue - p.amountPaid)}</span>
                </div>
              ))}
              <Link href="/payments" className="block text-center text-xs text-indigo-600 font-medium hover:underline pt-1 border-t border-slate-50 mt-1">
                View all payments →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Current Month Collection */}
      <div className="animate-fade-up stagger-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">{formatMonth(month)} — Rent Collection</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentMonthPayments.filter((p) => p.status === "PAID").length} / {currentMonthPayments.length} paid
            </p>
          </div>
          <Link href="/payments" className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
            View all <ChevronRight size={13} />
          </Link>
        </div>
        {currentMonthPayments.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-sm">No bills for this month.</p>
            <Link href="/payments" className="text-indigo-600 text-sm underline mt-1 inline-block">Generate bills</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {currentMonthPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-bold">
                    {p.tenant.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{p.tenant.name}</p>
                    <p className="text-xs text-slate-400">{p.room.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-900">{fmt(p.amountPaid)}</p>
                    <p className="text-xs text-slate-400">of {fmt(p.amountDue)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                  {p.status !== "PAID" && (
                    <Link href={`/payments/${p.id}/pay`} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors">
                      Pay
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Anniversary Reminders */}
      {anniversaryTenants.length > 0 && (
        <div className="animate-fade-up bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-violet-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎉</span>
            <h2 className="font-semibold text-violet-900">Move-in Anniversaries this month</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {anniversaryTenants.map(t => {
              const years = now.getFullYear() - t.moveInDate.getFullYear();
              return (
                <Link key={t.id} href={`/tenants/${t.id}`}
                  className="flex items-center gap-2 bg-white/80 border border-violet-100 rounded-xl px-3 py-2 text-sm hover:bg-white hover:border-violet-200 transition-all">
                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{t.name}</span>
                    <span className="text-xs text-violet-500 ml-1.5">{years} yr{years !== 1 ? "s" : ""}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up stagger-4">
        {[
          { href: "/rooms/new",    label: "Add Room",    sub: "Manage space",     icon: DoorOpen,   from: "from-indigo-500", to: "to-indigo-600", shadow: "shadow-indigo-200" },
          { href: "/tenants/new",  label: "Add Tenant",  sub: "New occupant",     icon: Users,      from: "from-violet-500", to: "to-violet-600", shadow: "shadow-violet-200" },
          { href: "/payments",     label: "Payments",    sub: "Record & track",   icon: CreditCard, from: "from-blue-500",   to: "to-blue-600",   shadow: "shadow-blue-200" },
          { href: "/expenses/new", label: "Add Expense", sub: "Track spending",   icon: Receipt,    from: "from-orange-500", to: "to-orange-600", shadow: "shadow-orange-200" },
        ].map(({ href, label, sub, icon: Icon, from, to, shadow }) => (
          <Link
            key={href}
            href={href}
            className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 hover:border-slate-200 hover:shadow-md transition-all group"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${from} ${to} flex items-center justify-center shadow-sm ${shadow} group-hover:scale-105 transition-transform`}>
              <Icon size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-400">{sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
