export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { MoveOutButton } from "./move-out-button";
import { VoidPaymentButton } from "./void-payment-button";
import { TenantRecurringChargesPanel } from "./tenant-recurring-charges";
import { getSettings } from "@/lib/settings";
import { ChevronRight } from "lucide-react";

function monthString(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthRange(start: string, end: string) {
  const months: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(monthString(y, m));
    if (++m > 12) { m = 1; y++; }
  }
  return months;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID:    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    PARTIAL: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    OVERDUE: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tenantBase = await prisma.tenant.findUnique({
    where: { id },
    include: { room: { include: { recurringCharges: true } }, oneTimeCharges: { orderBy: { date: "desc" } } },
  });

  if (!tenantBase) notFound();

  if (!tenantBase.moveOutDate && tenantBase.room && tenantBase.roomId) {
    const today        = new Date();
    const currentMonth = monthString(today.getFullYear(), today.getMonth() + 1);
    const moveInDate   = tenantBase.moveInDate;
    const moveInMonth  = monthString(moveInDate.getFullYear(), moveInDate.getMonth() + 1);
    for (const m of monthRange(moveInMonth, currentMonth)) {
      const chargesForMonth = tenantBase.room.recurringCharges
        .filter(c => (c.tenantId === null || c.tenantId === tenantBase.id) && (!c.effectiveFrom || c.effectiveFrom <= m))
        .reduce((s, c) => s + c.amount, 0);
      const baseAmount = tenantBase.room.monthlyRent + chargesForMonth;

      let amountDue = baseAmount;
      if (m === moveInMonth && moveInDate.getDate() > 1) {
        const daysInMonth  = new Date(moveInDate.getFullYear(), moveInDate.getMonth() + 1, 0).getDate();
        const daysOccupied = daysInMonth - moveInDate.getDate() + 1;
        amountDue = Math.round((daysOccupied / daysInMonth) * baseAmount);
      }

      const existing = await prisma.payment.findUnique({
        where: { tenantId_month: { tenantId: tenantBase.id, month: m } },
        select: { id: true, status: true },
      });

      if (!existing) {
        await prisma.payment.create({
          data: { tenantId: tenantBase.id, roomId: tenantBase.roomId, month: m, amountDue, amountPaid: 0, status: m < currentMonth ? "OVERDUE" : "PENDING" },
        });
      } else if (existing.status !== "PAID") {
        await prisma.payment.update({ where: { id: existing.id }, data: { amountDue } });
      }
    }
  }

  if (tenantBase.creditBalance > 0) {
    const unpaid = await prisma.payment.findMany({
      where:   { tenantId: tenantBase.id, status: { not: "PAID" } },
      orderBy: { month: "asc" },
    });
    let credit = tenantBase.creditBalance;
    for (const p of unpaid) {
      if (credit <= 0) break;
      const balance = p.amountDue - p.amountPaid;
      if (balance <= 0) continue;
      const apply   = Math.min(credit, balance);
      credit       -= apply;
      const newPaid = p.amountPaid + apply;
      await prisma.payment.update({
        where: { id: p.id },
        data:  { amountPaid: newPaid, status: newPaid >= p.amountDue ? "PAID" : "PARTIAL", method: "ADVANCE", notes: "Applied from advance credit" },
      });
    }
    if (credit !== tenantBase.creditBalance) {
      await prisma.tenant.update({ where: { id: tenantBase.id }, data: { creditBalance: credit } });
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      room: { include: { recurringCharges: { orderBy: { createdAt: "asc" } } } },
      payments: { orderBy: { month: "desc" }, include: { room: true } },
      oneTimeCharges: { orderBy: { date: "desc" } },
    },
  });

  if (!tenant) notFound();

  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  const isActive = !tenant.moveOutDate;
  const totalCollected  = tenant.payments.reduce((sum, p) => sum + p.amountPaid, 0) + tenant.oneTimeCharges.reduce((sum, c) => sum + c.amountPaid, 0);
  const totalOutstanding = tenant.payments.reduce((sum, p) => sum + Math.max(0, p.amountDue - p.amountPaid), 0) + tenant.oneTimeCharges.reduce((sum, c) => sum + Math.max(0, c.amount - c.amountPaid), 0);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-1">
            <Link href="/tenants" className="hover:text-slate-600 transition-colors">Tenants</Link>
            <ChevronRight size={14} />
            <span className="text-slate-600">{tenant.name}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-500"}`}>
              {isActive ? "Active" : "Past Tenant"}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/tenants/${id}/edit`}
            className="border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            Edit
          </Link>
          {isActive && <MoveOutButton tenantId={id} moveInDate={tenant.moveInDate.toISOString()} />}
        </div>
      </div>

      {/* Info + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Contact Info</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Phone</span>
              <span className="font-medium text-slate-800">{tenant.phone}</span>
            </div>
            {tenant.email && (
              <div className="flex justify-between">
                <span className="text-slate-400">Email</span>
                <span className="font-medium text-slate-800">{tenant.email}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Room</span>
              <span className="font-medium">
                {tenant.room ? (
                  <Link href={`/rooms/${tenant.room.id}`} className="text-indigo-600 hover:underline">{tenant.room.name}</Link>
                ) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Move-in</span>
              <span className="font-medium text-slate-800">{formatDate(tenant.moveInDate)}</span>
            </div>
            {tenant.moveOutDate && (
              <div className="flex justify-between">
                <span className="text-slate-400">Move-out</span>
                <span className="font-medium text-slate-800">{formatDate(tenant.moveOutDate)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Deposit</span>
              <span className="font-medium text-slate-800">{fmt(tenant.deposit)}</span>
            </div>
          </div>
          {tenant.notes && (
            <div className="pt-2.5 border-t border-slate-50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-slate-600">{tenant.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Collected</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(totalCollected)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Outstanding</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{fmt(totalOutstanding)}</p>
          </div>
          {tenant.creditBalance > 0 && (
            <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Advance Credit</p>
              <p className="text-2xl font-bold text-indigo-700 mt-1">{fmt(tenant.creditBalance)}</p>
              <p className="text-xs text-indigo-400 mt-1">Will auto-apply to next month</p>
            </div>
          )}
        </div>
      </div>

      {/* Recurring Charges */}
      {isActive && tenant.room && (
        <TenantRecurringChargesPanel
          tenantId={id}
          roomId={tenant.room.id}
          roomCharges={tenant.room.recurringCharges.filter(c => c.tenantId === null)}
          tenantCharges={tenant.room.recurringCharges.filter(c => c.tenantId === id)}
          currencySymbol={settings.currencySymbol}
          moveInMonth={`${tenant.moveInDate.getFullYear()}-${String(tenant.moveInDate.getMonth() + 1).padStart(2, "0")}`}
        />
      )}

      {/* Payment Ledger */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Payment Ledger</h2>
          <span className="text-xs text-slate-400">{tenant.payments.length} months</span>
        </div>
        {tenant.payments.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No payment records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Month</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Due</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Paid</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Paid On</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Method</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tenant.payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-800">{formatMonth(p.month)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(p.amountDue)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(p.amountPaid)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-slate-400">{p.paidDate ? formatDate(p.paidDate) : "—"}</td>
                    <td className="px-4 py-3 text-slate-400">{p.method ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.status !== "PAID" && (
                          <Link href={`/payments/${p.id}/pay`}
                            className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                            Pay
                          </Link>
                        )}
                        {p.amountPaid > 0 && <VoidPaymentButton paymentId={p.id} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* One-time Charges */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">One-time Charges</h2>
          {isActive && (
            <Link href={`/tenants/${id}/one-time-charge/new`}
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors font-medium">
              + Add Charge
            </Link>
          )}
        </div>
        {tenant.oneTimeCharges.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No one-time charges.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Paid</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tenant.oneTimeCharges.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-semibold text-slate-800">{c.title}</span>
                      {c.notes && <p className="text-xs text-slate-400 font-normal mt-0.5">{c.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(c.date)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(c.amount)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(c.amountPaid)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      {c.status !== "PAID" && (
                        <Link href={`/tenants/${id}/one-time-charge/${c.id}/pay`}
                          className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                          Pay
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
    </div>
  );
}
