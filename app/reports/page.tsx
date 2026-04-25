export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Download, ArrowUpRight, ArrowDownRight, Lock } from "lucide-react";
import { ReportsChart } from "@/components/reports-chart";
import { YearPicker } from "@/components/year-picker";
import { isPro } from "@/lib/plan";

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString("en", { month: "short", year: "numeric" });
}

function shortMonth(month: string): string {
  const [year, m] = month.split("-");
  return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString("en", { month: "short" });
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { requireAuth } = await import("@/lib/auth");
  const user = await requireAuth();

  const pro      = isPro(user);
  const settings = await getSettings(user.id);
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);
  const now     = new Date();
  const maxYear = now.getFullYear();

  // Find earliest year with any data to set minYear
  const [earliestPayment, earliestExpense] = await Promise.all([
    prisma.payment.findFirst({ where: { userId: user.id }, orderBy: { month: "asc" }, select: { month: true } }),
    prisma.expense.findFirst({ where: { userId: user.id }, orderBy: { date:  "asc" }, select: { date:  true } }),
  ]);
  const payYear = earliestPayment ? parseInt(earliestPayment.month.slice(0, 4)) : maxYear;
  const expYear = earliestExpense ? earliestExpense.date.getFullYear() : maxYear;
  const minYear = Math.min(payYear, expYear);

  const { year: yearParam } = await searchParams;
  const year = Math.min(maxYear, Math.max(minYear, parseInt(yearParam ?? String(maxYear)) || maxYear));

  const months: string[] = [];
  for (let m = 1; m <= 12; m++) months.push(`${year}-${String(m).padStart(2, "0")}`);

  const prevYear = year - 1;
  const [payments, expenses, oneTimeCharges, prevPayments, prevExpenses, prevOneTime, rooms] = await Promise.all([
    prisma.payment.findMany({ where: { userId: user.id, month: { gte: `${year}-01`, lte: `${year}-12` } } }),
    prisma.expense.findMany({ where: { userId: user.id, date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } }),
    prisma.oneTimeCharge.findMany({ where: { userId: user.id, date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } }),
    prisma.payment.findMany({ where: { userId: user.id, month: { gte: `${prevYear}-01`, lte: `${prevYear}-12` } } }),
    prisma.expense.findMany({ where: { userId: user.id, date: { gte: new Date(`${prevYear}-01-01`), lte: new Date(`${prevYear}-12-31`) } }, select: { amount: true } }),
    prisma.oneTimeCharge.findMany({ where: { userId: user.id, date: { gte: new Date(`${prevYear}-01-01`), lte: new Date(`${prevYear}-12-31`) } }, select: { amountPaid: true } }),
    prisma.room.findMany({
      where: { userId: user.id },
      include: {
        payments: { where: { month: { gte: `${year}-01`, lte: `${year}-12` } }, select: { amountDue: true, amountPaid: true } },
        expenses: { where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } }, select: { amount: true } },
        tenants: { where: { moveOutDate: null }, select: { id: true } },
      },
    }),
  ]);

  const paymentsByMonth: Record<string, { due: number; collected: number }> = {};
  for (const p of payments) {
    if (!paymentsByMonth[p.month]) paymentsByMonth[p.month] = { due: 0, collected: 0 };
    paymentsByMonth[p.month].due       += p.amountDue;
    paymentsByMonth[p.month].collected += p.amountPaid;
  }

  const oneTimeByMonth: Record<string, { due: number; collected: number }> = {};
  for (const c of oneTimeCharges) {
    const d   = new Date(c.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!oneTimeByMonth[key]) oneTimeByMonth[key] = { due: 0, collected: 0 };
    oneTimeByMonth[key].due       += c.amount;
    oneTimeByMonth[key].collected += c.amountPaid;
  }

  const expensesByMonth: Record<string, number> = {};
  for (const e of expenses) {
    const d   = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    expensesByMonth[key] = (expensesByMonth[key] || 0) + e.amount;
  }

  type MonthRow = { month: string; due: number; collected: number; rate: number; expenses: number; net: number };
  const rows: MonthRow[] = months.map((month) => {
    const due       = (paymentsByMonth[month]?.due ?? 0) + (oneTimeByMonth[month]?.due ?? 0);
    const collected = (paymentsByMonth[month]?.collected ?? 0) + (oneTimeByMonth[month]?.collected ?? 0);
    const rate      = due > 0 ? Math.round((collected / due) * 100) : 0;
    const exp       = expensesByMonth[month] ?? 0;
    return { month, due, collected, rate, expenses: exp, net: collected - exp };
  });

  const totalDue       = rows.reduce((s, r) => s + r.due, 0);
  const totalCollected = rows.reduce((s, r) => s + r.collected, 0);
  const totalExpenses  = rows.reduce((s, r) => s + r.expenses, 0);
  const totalNet       = totalCollected - totalExpenses;
  const totalRate      = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

  const categoryTotals: Record<string, number> = {};
  for (const e of expenses) categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Year-over-year
  const prevCollected  = prevPayments.reduce((s, p) => s + p.amountPaid, 0) + prevOneTime.reduce((s, c) => s + c.amountPaid, 0);
  const prevTotalExp   = prevExpenses.reduce((s, e) => s + e.amount, 0);
  const yoyCollected   = prevCollected > 0 ? Math.round(((totalCollected - prevCollected) / prevCollected) * 100) : null;
  const yoyExpenses    = prevTotalExp > 0 ? Math.round(((totalExpenses - prevTotalExp) / prevTotalExp) * 100) : null;

  // Room profitability
  const roomProfits = rooms.map(r => {
    const collected = r.payments.reduce((s, p) => s + p.amountPaid, 0);
    const exp       = r.expenses.reduce((s, e) => s + e.amount, 0);
    return { id: r.id, name: r.name, collected, expenses: exp, net: collected - exp, occupied: r.tenants.length > 0 };
  }).sort((a, b) => b.net - a.net);

  const chartData = rows
    .filter((r) => r.due > 0 || r.expenses > 0)
    .map((r) => ({ month: shortMonth(r.month), collected: r.collected, expenses: r.expenses, net: r.net }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Financial summary for {year}</p>
        </div>
        <div className="flex items-center gap-3">
          {pro ? (
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`/api/reports/export?type=summary&year=${year}`} download
                className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Download size={14} /> Summary
              </a>
              <a href={`/api/reports/export?type=payments&year=${year}`} download
                className="inline-flex items-center gap-1.5 border border-indigo-200 text-indigo-600 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors">
                <Download size={14} /> Payments
              </a>
              <a href={`/api/reports/export?type=expenses&year=${year}`} download
                className="inline-flex items-center gap-1.5 border border-rose-200 text-rose-600 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-rose-50 transition-colors">
                <Download size={14} /> Expenses
              </a>
              <a href="/api/reports/export?type=tenants" download
                className="inline-flex items-center gap-1.5 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-50 transition-colors">
                <Download size={14} /> Tenants
              </a>
            </div>
          ) : (
            <span
              title="Upgrade to Pro to export reports"
              className="inline-flex items-center gap-1.5 border border-slate-200 text-slate-400 px-3 py-2 rounded-xl text-sm font-semibold cursor-not-allowed select-none"
            >
              <Lock size={14} />
              Export CSV
              <span className="ml-1 text-[10px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">PRO</span>
            </span>
          )}
          <Suspense>
            <YearPicker year={year} minYear={minYear} maxYear={maxYear} />
          </Suspense>
        </div>
      </div>

      {/* Year-over-Year comparison */}
      {(yoyCollected !== null || yoyExpenses !== null) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {yoyCollected !== null && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Collection vs {prevYear}</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">{fmt(totalCollected)} <span className="font-normal text-slate-400">this year</span></p>
                <p className="text-xs text-slate-400">{fmt(prevCollected)} last year</p>
              </div>
              <span className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-xl ${yoyCollected >= 0 ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"}`}>
                {yoyCollected >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(yoyCollected)}%
              </span>
            </div>
          )}
          {yoyExpenses !== null && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Expenses vs {prevYear}</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">{fmt(totalExpenses)} <span className="font-normal text-slate-400">this year</span></p>
                <p className="text-xs text-slate-400">{fmt(prevTotalExp)} last year</p>
              </div>
              <span className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-xl ${yoyExpenses <= 0 ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"}`}>
                {yoyExpenses >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(yoyExpenses)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Due</p>
            <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
              <DollarSign size={14} className="text-slate-500" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{fmt(totalDue)}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Collected</p>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center">
              <TrendingUp size={14} className="text-emerald-500" />
            </div>
          </div>
          <p className="text-xl font-bold text-emerald-600">{fmt(totalCollected)}</p>
          {totalDue > 0 && <p className="text-xs text-slate-400 mt-1">{totalRate}% collection rate</p>}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Expenses</p>
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/15 flex items-center justify-center">
              <TrendingDown size={14} className="text-orange-500" />
            </div>
          </div>
          <p className="text-xl font-bold text-orange-600">{fmt(totalExpenses)}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Net Income</p>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${totalNet >= 0 ? "bg-emerald-50 dark:bg-emerald-500/15" : "bg-rose-50 dark:bg-rose-500/15"}`}>
              <BarChart3 size={14} className={totalNet >= 0 ? "text-emerald-500" : "text-rose-500"} />
            </div>
          </div>
          <p className={`text-xl font-bold ${totalNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmt(totalNet)}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Monthly Overview</h2>
            <p className="text-xs text-slate-400 mt-0.5">Collected vs Expenses vs Net — {year}</p>
          </div>
          <ReportsChart data={chartData} />
        </div>
      )}

      {/* Monthly Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Monthly Breakdown</h2>
          <span className="text-xs text-slate-400">{year}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Month</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Rent Due</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Collected</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Rate</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Expenses</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.month} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors ${row.due === 0 && row.expenses === 0 ? "opacity-30" : ""}`}>
                  <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">{formatMonthLabel(row.month)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row.due > 0 ? fmt(row.due) : "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row.collected > 0 ? fmt(row.collected) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {row.due > 0 ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${
                        row.rate >= 90 ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                        row.rate >= 50 ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                        "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400"
                      }`}>
                        {row.rate}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-600">{row.expenses > 0 ? fmt(row.expenses) : "—"}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${row.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {row.due > 0 || row.expenses > 0 ? fmt(row.net) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 font-bold">
                <td className="px-5 py-3.5 text-slate-900 dark:text-white">Total</td>
                <td className="px-4 py-3.5 text-right text-slate-900 dark:text-slate-200">{fmt(totalDue)}</td>
                <td className="px-4 py-3.5 text-right text-emerald-600">{fmt(totalCollected)}</td>
                <td className="px-4 py-3.5 text-right">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${
                    totalRate >= 90 ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                    totalRate >= 50 ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                    "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400"
                  }`}>
                    {totalRate}%
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-orange-600">{fmt(totalExpenses)}</td>
                <td className={`px-4 py-3.5 text-right ${totalNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmt(totalNet)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Room Profitability */}
      {roomProfits.some(r => r.collected > 0 || r.expenses > 0) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white">Room Profitability — {year}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Rent collected minus direct expenses per room</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Room</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Collected</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Expenses</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Net</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {roomProfits.filter(r => r.collected > 0 || r.expenses > 0).map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">{r.name}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{r.collected > 0 ? fmt(r.collected) : "—"}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{r.expenses > 0 ? fmt(r.expenses) : "—"}</td>
                    <td className={`px-4 py-3 text-right font-bold ${r.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmt(r.net)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${r.occupied ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                        {r.occupied ? "Occupied" : "Vacant"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Expense Categories */}
      {topCategories.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-5">Top Expense Categories</h2>
          <div className="space-y-4">
            {topCategories.map(([cat, amount]) => {
              const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{cat}</span>
                    <span className="text-slate-500">{fmt(amount)} <span className="text-slate-400">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                    <div className="bg-gradient-to-r from-indigo-500 to-orange-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
