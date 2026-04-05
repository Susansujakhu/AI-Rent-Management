export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { MoveOutButton } from "./move-out-button";
import { VoidPaymentButton } from "./void-payment-button";
import { TenantRecurringChargesPanel } from "./tenant-recurring-charges";
import { getSettings } from "@/lib/settings";

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

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch tenant + room info first so we can generate missing payment rows
  const tenantBase = await prisma.tenant.findUnique({
    where: { id },
    include: { room: { include: { recurringCharges: true } }, oneTimeCharges: { orderBy: { date: "desc" } } },
  });

  if (!tenantBase) notFound();

  // Auto-generate a payment row for every month from move-in → today (active tenants only)
  if (!tenantBase.moveOutDate && tenantBase.room && tenantBase.roomId) {
    const today        = new Date();
    const currentMonth = monthString(today.getFullYear(), today.getMonth() + 1);
    const moveInDate   = tenantBase.moveInDate;
    const moveInMonth  = monthString(moveInDate.getFullYear(), moveInDate.getMonth() + 1);
    for (const m of monthRange(moveInMonth, currentMonth)) {
      // Only include charges active for this month and applicable to this tenant
      const chargesForMonth = tenantBase.room.recurringCharges
        .filter((c) =>
          (c.tenantId === null || c.tenantId === tenantBase.id) &&
          (!c.effectiveFrom || c.effectiveFrom <= m)
        )
        .reduce((s, c) => s + c.amount, 0);
      const baseAmount = tenantBase.room.monthlyRent + chargesForMonth;

      // Pro-rate the first month if tenant moved in after the 1st
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
        // Recalculate unpaid bills when charges change — never touch PAID bills
        await prisma.payment.update({ where: { id: existing.id }, data: { amountDue } });
      }
    }
  }

  // Apply any stored credit balance to newly created unpaid months (oldest first)
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
        data:  {
          amountPaid: newPaid,
          status: newPaid >= p.amountDue ? "PAID" : "PARTIAL",
          method: "ADVANCE",
          notes:  "Applied from advance credit",
        },
      });
    }
    if (credit !== tenantBase.creditBalance) {
      await prisma.tenant.update({
        where: { id: tenantBase.id },
        data:  { creditBalance: credit },
      });
    }
  }

  // Re-fetch with payments now that rows exist
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      room: { include: { recurringCharges: { orderBy: { createdAt: "asc" } } } },
      payments: {
        orderBy: { month: "desc" },
        include: { room: true },
      },
      oneTimeCharges: { orderBy: { date: "desc" } },
    },
  });

  if (!tenant) notFound();

  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  const isActive = !tenant.moveOutDate;
  const totalCollected = tenant.payments.reduce((sum, p) => sum + p.amountPaid, 0)
    + tenant.oneTimeCharges.reduce((sum, c) => sum + c.amountPaid, 0);
  const totalOutstanding = tenant.payments.reduce((sum, p) => sum + Math.max(0, p.amountDue - p.amountPaid), 0)
    + tenant.oneTimeCharges.reduce((sum, c) => sum + Math.max(0, c.amount - c.amountPaid), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/tenants" className="text-sm text-gray-500 hover:text-gray-700">Tenants</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-700">{tenant.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{tenant.name}</h1>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
            {isActive ? "Active" : "Past Tenant"}
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/tenants/${id}/edit`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
          {isActive && (
            <MoveOutButton
              tenantId={id}
              moveInDate={tenant.moveInDate.toISOString()}
            />
          )}
        </div>
      </div>

      {/* Tenant Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Contact Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="font-medium text-gray-900">{tenant.phone}</span>
            </div>
            {tenant.email && (
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900">{tenant.email}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Room</span>
              <span className="font-medium text-gray-900">
                {tenant.room ? (
                  <Link href={`/rooms/${tenant.room.id}`} className="text-blue-600 hover:underline">
                    {tenant.room.name}
                  </Link>
                ) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Move-in</span>
              <span className="font-medium text-gray-900">{formatDate(tenant.moveInDate)}</span>
            </div>
            {tenant.moveOutDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">Move-out</span>
                <span className="font-medium text-gray-900">{formatDate(tenant.moveOutDate)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Deposit</span>
              <span className="font-medium text-gray-900">{fmt(tenant.deposit)}</span>
            </div>
          </div>
          {tenant.notes && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{tenant.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Collected</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{fmt(totalCollected)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Outstanding</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{fmt(totalOutstanding)}</p>
          </div>
          {tenant.creditBalance > 0 && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <p className="text-xs text-blue-600 uppercase tracking-wide">Advance Credit</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{fmt(tenant.creditBalance)}</p>
              <p className="text-xs text-blue-500 mt-1">Will auto-apply to next month</p>
            </div>
          )}
        </div>
      </div>

      {/* Recurring Charges */}
      {isActive && tenant.room && (
        <TenantRecurringChargesPanel
          tenantId={id}
          roomId={tenant.room.id}
          roomCharges={tenant.room.recurringCharges.filter((c) => c.tenantId === null)}
          tenantCharges={tenant.room.recurringCharges.filter((c) => c.tenantId === id)}
          currencySymbol={settings.currencySymbol}
          moveInMonth={`${tenant.moveInDate.getFullYear()}-${String(tenant.moveInDate.getMonth() + 1).padStart(2, "0")}`}
        />
      )}

      {/* Payment Ledger */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Payment Ledger</h2>
        </div>
        {tenant.payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No payment records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Month</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Due</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid On</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Method</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tenant.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{formatMonth(p.month)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(p.amountDue)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(p.amountPaid)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-gray-500">{p.paidDate ? formatDate(p.paidDate) : "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{p.method ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.status !== "PAID" && (
                          <Link
                            href={`/payments/${p.id}/pay`}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                          >
                            Pay
                          </Link>
                        )}
                        {p.amountPaid > 0 && (
                          <VoidPaymentButton paymentId={p.id} />
                        )}
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
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">One-time Charges</h2>
          {isActive && (
            <Link
              href={`/tenants/${id}/one-time-charge/new`}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              + Add Charge
            </Link>
          )}
        </div>
        {tenant.oneTimeCharges.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No one-time charges.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tenant.oneTimeCharges.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {c.title}
                      {c.notes && <p className="text-xs text-gray-400 font-normal">{c.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(c.date)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(c.amount)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(c.amountPaid)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      {c.status !== "PAID" && (
                        <Link
                          href={`/tenants/${id}/one-time-charge/${c.id}/pay`}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                        >
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
