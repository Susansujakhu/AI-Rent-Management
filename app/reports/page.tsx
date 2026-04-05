export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString("en", {
    month: "short",
    year: "numeric",
  });
}

export default async function ReportsPage() {
  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);
  const now = new Date();
  const year = now.getFullYear();

  // Build list of months for current year
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${year}-${String(m).padStart(2, "0")}`);
  }

  // Fetch all payments, expenses and one-time charges for the year
  const [payments, expenses, oneTimeCharges] = await Promise.all([
    prisma.payment.findMany({
      where: { month: { gte: `${year}-01`, lte: `${year}-12` } },
    }),
    prisma.expense.findMany({
      where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
    }),
    prisma.oneTimeCharge.findMany({
      where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
    }),
  ]);

  // Group payments by month
  const paymentsByMonth: Record<string, { due: number; collected: number }> = {};
  for (const p of payments) {
    if (!paymentsByMonth[p.month]) paymentsByMonth[p.month] = { due: 0, collected: 0 };
    paymentsByMonth[p.month].due += p.amountDue;
    paymentsByMonth[p.month].collected += p.amountPaid;
  }

  // Group one-time charges by month (using charge date)
  const oneTimeByMonth: Record<string, { due: number; collected: number }> = {};
  for (const c of oneTimeCharges) {
    const d = new Date(c.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!oneTimeByMonth[key]) oneTimeByMonth[key] = { due: 0, collected: 0 };
    oneTimeByMonth[key].due += c.amount;
    oneTimeByMonth[key].collected += c.amountPaid;
  }

  // Group expenses by month
  const expensesByMonth: Record<string, number> = {};
  for (const e of expenses) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    expensesByMonth[key] = (expensesByMonth[key] || 0) + e.amount;
  }

  // Build monthly rows
  type MonthRow = {
    month: string;
    due: number;
    collected: number;
    rate: number;
    expenses: number;
    net: number;
  };
  const rows: MonthRow[] = months.map((month) => {
    const due = (paymentsByMonth[month]?.due ?? 0) + (oneTimeByMonth[month]?.due ?? 0);
    const collected = (paymentsByMonth[month]?.collected ?? 0) + (oneTimeByMonth[month]?.collected ?? 0);
    const rate = due > 0 ? Math.round((collected / due) * 100) : 0;
    const exp = expensesByMonth[month] ?? 0;
    return { month, due, collected, rate, expenses: exp, net: collected - exp };
  });

  // Totals
  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  const totalCollected = rows.reduce((s, r) => s + r.collected, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const totalNet = totalCollected - totalExpenses;
  const totalRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

  // Top expense categories
  const categoryTotals: Record<string, number> = {};
  for (const e of expenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  }
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Financial summary for {year}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Due</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{fmt(totalDue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Collected</p>
          <p className="text-xl font-bold text-green-600 mt-1">{fmt(totalCollected)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Expenses</p>
          <p className="text-xl font-bold text-orange-600 mt-1">{fmt(totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Net Income</p>
          <p className={`text-xl font-bold mt-1 ${totalNet >= 0 ? "text-green-600" : "text-red-600"}`}>
            {fmt(totalNet)}
          </p>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Monthly Breakdown — {year}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Month</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Rent Due</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Collected</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Rate</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Expenses</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.month} className={`hover:bg-gray-50 ${row.due === 0 && row.expenses === 0 ? "text-gray-300" : ""}`}>
                  <td className="px-5 py-3 font-medium text-gray-900">{formatMonthLabel(row.month)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.due > 0 ? fmt(row.due) : "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.collected > 0 ? fmt(row.collected) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {row.due > 0 ? (
                      <span className={`font-medium ${row.rate >= 90 ? "text-green-600" : row.rate >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                        {row.rate}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-600">{row.expenses > 0 ? fmt(row.expenses) : "—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${row.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {row.due > 0 || row.expenses > 0 ? fmt(row.net) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-5 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-right text-gray-900">{fmt(totalDue)}</td>
                <td className="px-4 py-3 text-right text-green-600">{fmt(totalCollected)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`${totalRate >= 90 ? "text-green-600" : totalRate >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                    {totalRate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-orange-600">{fmt(totalExpenses)}</td>
                <td className={`px-4 py-3 text-right ${totalNet >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmt(totalNet)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Top Expense Categories */}
      {topCategories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Top Expense Categories</h2>
          <div className="space-y-3">
            {topCategories.map(([cat, amount]) => {
              const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{cat}</span>
                    <span className="text-gray-600">{fmt(amount)} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-orange-400 h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
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
