export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentMonth, formatCurrency, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { GenerateBillsButton } from "./generate-bills-button";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID:    "bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-100",
    PARTIAL: "bg-blue-50 text-blue-700 border border-blue-200 ring-1 ring-blue-100",
    PENDING: "bg-amber-50 text-amber-700 border border-amber-200 ring-1 ring-amber-100",
    OVERDUE: "bg-rose-50 text-rose-700 border border-rose-200 ring-1 ring-rose-100",
  };
  const dots: Record<string, string> = {
    PAID: "bg-emerald-500", PARTIAL: "bg-blue-500", PENDING: "bg-amber-400", OVERDUE: "bg-rose-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? "bg-slate-400"}`} />
      {status}
    </span>
  );
}

import { ChevronLeft, ChevronRight, Receipt, FileText } from "lucide-react";
import { PaymentsTable } from "@/components/payments-table";


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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">{formatMonth(month)}</p>
        </div>
        <GenerateBillsButton month={month} />
      </div>

      {/* Month Navigation — centered pill selector */}
      <div className="flex items-center justify-center gap-1">
        <Link
          href={`/payments?month=${prevMonth(month)}`}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:bg-white hover:border-slate-300 hover:text-slate-700 transition-all shadow-sm"
        >
          <ChevronLeft size={15} />
        </Link>

        <div className="flex items-center bg-slate-100/80 rounded-full p-1 mx-1">
          <span className="px-5 py-1.5 rounded-full bg-white shadow-sm text-sm font-semibold text-slate-800 border border-slate-200/80">
            {formatMonth(month)}
          </span>
        </div>

        <Link
          href={`/payments?month=${nextMonth(month)}`}
          className={`flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:bg-white hover:border-slate-300 hover:text-slate-700 transition-all shadow-sm ${month >= curr ? "opacity-30 pointer-events-none" : ""}`}
        >
          <ChevronRight size={15} />
        </Link>

        {month !== curr && (
          <Link
            href="/payments"
            className="ml-2 text-xs text-indigo-600 font-semibold hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-all"
          >
            Today
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Total Due — slate accent */}
        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-slate-400 rounded-l-2xl" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Due</p>
          <p className="text-xl font-black text-slate-900 mt-2 tracking-tight">{fmt(totalDue)}</p>
          <p className="text-xs text-slate-400 mt-1">{payments.length} tenant{payments.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Collected — emerald gradient */}
        <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-sm shadow-emerald-200 p-5 overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Collected</p>
          <p className="text-xl font-black text-white mt-2 tracking-tight">{fmt(totalPaid)}</p>
          {totalDue > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-emerald-100">{collectionRate}% rate</span>
              </div>
              <div className="w-full bg-emerald-400/40 rounded-full h-1">
                <div className="bg-white h-1 rounded-full transition-all" style={{ width: `${collectionRate}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Paid count — ratio display */}
        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-indigo-400 rounded-l-2xl" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fully Paid</p>
          <div className="mt-2 flex items-end gap-1.5">
            <p className="text-xl font-black text-slate-900 tracking-tight">{paidCount}</p>
            <p className="text-sm text-slate-400 font-medium mb-0.5">/ {payments.length}</p>
          </div>
          {payments.length > 0 && (
            <div className="mt-2">
              <div className="w-full bg-slate-100 rounded-full h-1">
                <div
                  className="bg-indigo-500 h-1 rounded-full transition-all"
                  style={{ width: `${Math.round((paidCount / payments.length) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FileText size={13} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                {payments.length} payment{payments.length !== 1 ? "s" : ""}
              </h2>
              <p className="text-xs text-slate-400">{formatMonth(month)}</p>
            </div>
          </div>
        </div>
        {payments.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <FileText size={20} className="text-slate-300" />
            </div>
            <p className="text-sm text-slate-500 font-medium">No payments for this month</p>
            <p className="text-xs text-slate-400 mt-1">
              Click <span className="text-indigo-600 font-semibold">&quot;Generate Bills&quot;</span> to create them.
            </p>
          </div>
        ) : (
          <PaymentsTable
            payments={payments.map(p => ({ ...p, paidDate: p.paidDate?.toISOString() ?? null, createdAt: p.createdAt.toISOString() }))}
            currencySymbol={settings.currencySymbol}
          />
        )}
      </div>

      {/* One-Time Charges */}
      {oneTimeCharges.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
              <Receipt size={13} className="text-orange-500" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                {oneTimeCharges.length} one-time charge{oneTimeCharges.length !== 1 ? "s" : ""}
              </h2>
              <p className="text-xs text-slate-400">{formatMonth(month)}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-slate-50/40">
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid</th>
                  <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {oneTimeCharges.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-5 py-4">
                      <Link href={`/tenants/${c.tenantId}`} className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                        {c.tenant.name}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-slate-500">{c.title}</td>
                    <td className="px-4 py-4 text-right font-medium text-slate-600">{fmt(c.amount)}</td>
                    <td className="px-4 py-4 text-right font-bold text-slate-900">{fmt(c.amountPaid)}</td>
                    <td className="px-4 py-4 text-center"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-4 text-right">
                      {c.status !== "PAID" && (
                        <Link href={`/tenants/${c.tenantId}`} className="text-xs text-indigo-600 font-semibold hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
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
