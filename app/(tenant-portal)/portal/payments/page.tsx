export const dynamic = "force-dynamic";

import { requireTenantPage } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { PortalShell } from "../_components/portal-shell";
import Link from "next/link";
import { FileText } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  PAID:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTIAL: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  OVERDUE: "bg-rose-50 text-rose-700 border-rose-200",
};

export default async function PortalPaymentsPage() {
  const session  = await requireTenantPage();
  const tenant   = session.tenant;
  const settings = await getSettings();
  const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);

  const payments = await prisma.payment.findMany({
    where:   { tenantId: tenant.id },
    orderBy: { month: "desc" },
    include: { room: { select: { name: true } } },
  });

  const totalDue     = payments.reduce((s, p) => s + p.amountDue, 0);
  const totalPaid    = payments.reduce((s, p) => s + p.amountPaid, 0);
  const overdueCount = payments.filter(p => p.status === "OVERDUE").length;

  return (
    <PortalShell tenantName={tenant.name} roomName={tenant.room?.name ?? null}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payment History</h1>
          <p className="text-sm text-slate-500 mt-0.5">{payments.length} months recorded</p>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total charged</span>
            <span className="font-semibold text-slate-800">{fmt(totalDue)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total paid</span>
            <span className="font-semibold text-emerald-700">{fmt(totalPaid)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
            <span className="text-slate-500">Outstanding</span>
            <span className={`font-bold ${totalDue - totalPaid > 0 ? "text-rose-600" : "text-slate-800"}`}>
              {fmt(Math.max(0, totalDue - totalPaid))}
            </span>
          </div>
          {overdueCount > 0 && (
            <p className="text-xs text-rose-600 font-medium">{overdueCount} overdue month{overdueCount > 1 ? "s" : ""}</p>
          )}
        </div>

        {/* Payment list */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {payments.length === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">No payment records yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {payments.map(p => (
                <div key={p.id} className="px-4 py-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{formatMonth(p.month)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.room.name}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLES[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <p>Due: <span className="font-medium text-slate-700">{fmt(p.amountDue)}</span></p>
                      <p>Paid: <span className="font-medium text-slate-700">{fmt(p.amountPaid)}</span></p>
                      {p.paidDate && <p>On: {formatDate(p.paidDate)}</p>}
                      {p.method && <p className="uppercase">{p.method}</p>}
                    </div>
                    {p.amountPaid > 0 && (
                      <Link
                        href={`/portal/payments/${p.id}/receipt`}
                        className="flex items-center gap-1.5 text-xs text-teal-600 font-semibold border border-teal-200 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <FileText size={12} />
                        Receipt
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
