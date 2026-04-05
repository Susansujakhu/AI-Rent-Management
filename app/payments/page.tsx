export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentMonth, formatCurrency, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { GenerateBillsButton } from "./generate-bills-button";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-green-100 text-green-800",
    PARTIAL: "bg-blue-100 text-blue-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    OVERDUE: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-800"}`}>
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
  const month = monthParam || currentMonth();
  const curr = currentMonth();
  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">{formatMonth(month)}</p>
        </div>
        <GenerateBillsButton month={month} />
      </div>

      {/* Month Navigation */}
      <div className="flex items-center gap-2">
        <Link
          href={`/payments?month=${prevMonth(month)}`}
          className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          ← Prev
        </Link>
        <span className="text-sm font-medium text-gray-700 px-2">{formatMonth(month)}</span>
        <Link
          href={`/payments?month=${nextMonth(month)}`}
          className={`border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors ${month >= curr ? "opacity-50 pointer-events-none" : ""}`}
        >
          Next →
        </Link>
        {month !== curr && (
          <Link
            href="/payments"
            className="ml-2 text-sm text-blue-600 hover:underline"
          >
            Back to current month
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Due</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{fmt(totalDue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Collected</p>
          <p className="text-xl font-bold text-green-600 mt-1">{fmt(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Paid</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{paidCount} / {payments.length}</p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} for {formatMonth(month)}
          </h2>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No payments for this month. Click &quot;Generate Bills&quot; to create them.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tenant</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Room</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Due</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid On</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/tenants/${p.tenantId}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {p.tenant.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <Link href={`/rooms/${p.roomId}`} className="hover:text-blue-600">
                        {p.room.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(p.amountDue)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(p.amountPaid)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {p.paidDate ? new Date(p.paidDate).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {p.status !== "PAID" && (
                        <Link
                          href={`/payments/${p.id}/pay`}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
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
        )}
      </div>

      {/* One-Time Charges for this month */}
      {oneTimeCharges.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              {oneTimeCharges.length} one-time charge{oneTimeCharges.length !== 1 ? "s" : ""} for {formatMonth(month)}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tenant</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {oneTimeCharges.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/tenants/${c.tenantId}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {c.tenant.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.title}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(c.amount)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(c.amountPaid)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {c.status !== "PAID" && (
                        <Link
                          href={`/tenants/${c.tenantId}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
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
