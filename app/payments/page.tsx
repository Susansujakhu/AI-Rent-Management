export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentMonth, formatCurrency, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { GenerateBillsButton } from "./generate-bills-button";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";

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

function prevMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month    = monthParam || currentMonth();
  const curr     = currentMonth();
  const settings = await getSettings();
  const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);

  const payments = await prisma.payment.findMany({
    where: { month },
    include: { tenant: true, room: true },
    orderBy: { createdAt: "desc" },
  });

  const [yr, mo] = month.split("-").map(Number);
  const oneTimeCharges = await prisma.oneTimeCharge.findMany({
    where: { date: { gte: new Date(yr, mo - 1, 1), lt: new Date(yr, mo, 1) } },
    include: { tenant: true },
    orderBy: { date: "asc" },
  });

  const totalDue  = payments.reduce((s, p) => s + p.amountDue, 0)
    + oneTimeCharges.reduce((s, c) => s + c.amount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0)
    + oneTimeCharges.reduce((s, c) => s + c.amountPaid, 0);
  const paidCount = payments.filter((p) => p.status === "PAID").length;
  const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">{formatMonth(month)}</p>
        </div>
        <GenerateBillsButton month={month} />
      </div>

      {/* Month Navigation */}
      <div className="flex items-center gap-2">
        <Link
          href={`/payments?month=${prevMonth(month)}`}
          className="flex items-center gap-1 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-white hover:border-slate-300 transition-colors"
        >
          <ChevronLeft size={14} /> Prev
        </Link>
        <span className="text-sm font-semibold text-slate-700 px-3 py-1.5 bg-white border border-slate-200 rounded-xl">
          {formatMonth(month)}
        </span>
        <Link
          href={`/payments?month=${nextMonth(month)}`}
          className={`flex items-center gap-1 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-white hover:border-slate-300 transition-colors ${month >= curr ? "opacity-40 pointer-events-none" : ""}`}
        >
          Next <ChevronRight size={14} />
        </Link>
        {month !== curr && (
          <Link href="/payments" className="ml-1 text-sm text-indigo-600 font-medium hover:underline">
            Current month
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Due</p>
          <p className="text-xl font-bold text-slate-900 mt-1.5">{fmt(totalDue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Collected</p>
          <p className="text-xl font-bold text-emerald-600 mt-1.5">{fmt(totalPaid)}</p>
          {totalDue > 0 && <p className="text-xs text-slate-400 mt-0.5">{collectionRate}% rate</p>}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Paid</p>
          <p className="text-xl font-bold text-slate-900 mt-1.5">{paidCount} <span className="text-slate-400 font-normal text-base">/ {payments.length}</span></p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} for {formatMonth(month)}
          </h2>
        </div>
        {payments.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No payments for this month. Click <span className="text-indigo-600 font-medium">&quot;Generate Bills&quot;</span> to create them.
          </div>
        ) : (
          <>
          {/* Mobile cards */}
          <div className="divide-y divide-slate-50 sm:hidden">
            {payments.map((p) => (
              <div key={p.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Link href={`/tenants/${p.tenantId}`} className="font-semibold text-slate-900">{p.tenant.name}</Link>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{p.room.name}</span>
                  <span className="font-bold text-slate-900">{fmt(p.amountPaid)} <span className="font-normal text-slate-400">/ {fmt(p.amountDue)}</span></span>
                </div>
                {p.paidDate && <p className="text-xs text-slate-400">{new Date(p.paidDate).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" })}</p>}
                {p.status !== "PAID" && (
                  <Link href={`/payments/${p.id}/pay`} className="block w-full text-center text-xs bg-indigo-600 text-white py-2 rounded-xl font-semibold hover:bg-indigo-700">
                    Record Payment
                  </Link>
                )}
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Tenant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Room</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Due</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Paid On</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/tenants/${p.tenantId}`} className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                        {p.tenant.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link href={`/rooms/${p.roomId}`} className="text-slate-500 hover:text-indigo-600 transition-colors">
                        {p.room.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-slate-700">{fmt(p.amountDue)}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">{fmt(p.amountPaid)}</td>
                    <td className="px-4 py-3.5 text-right text-xs text-slate-400">
                      {p.paidDate ? new Date(p.paidDate).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-center"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3.5 text-right">
                      {p.status !== "PAID" && (
                        <Link
                          href={`/payments/${p.id}/pay`}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                        >
                          Record Payment
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* One-Time Charges */}
      {oneTimeCharges.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-3">
            <Receipt size={16} className="text-orange-500" />
            <h2 className="font-semibold text-slate-900">
              {oneTimeCharges.length} one-time charge{oneTimeCharges.length !== 1 ? "s" : ""} for {formatMonth(month)}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Tenant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Paid</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {oneTimeCharges.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/tenants/${c.tenantId}`} className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                        {c.tenant.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{c.title}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-slate-700">{fmt(c.amount)}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">{fmt(c.amountPaid)}</td>
                    <td className="px-4 py-3.5 text-center"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3.5 text-right">
                      {c.status !== "PAID" && (
                        <Link href={`/tenants/${c.tenantId}`} className="text-xs text-indigo-600 font-medium hover:underline">
                          View tenant →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
