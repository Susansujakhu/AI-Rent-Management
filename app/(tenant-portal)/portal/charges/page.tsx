export const dynamic = "force-dynamic";

import { requireTenantPage } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { PortalShell } from "../_components/portal-shell";

const STATUS_STYLES: Record<string, string> = {
  PAID:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTIAL: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
};

export default async function PortalChargesPage() {
  const session  = await requireTenantPage();
  const tenant   = session.tenant;
  const settings = await getSettings();
  const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);

  const charges = await prisma.oneTimeCharge.findMany({
    where:   { tenantId: tenant.id },
    orderBy: { date: "desc" },
  });

  const totalCharged     = charges.reduce((s, c) => s + c.amount, 0);
  const totalPaid        = charges.reduce((s, c) => s + c.amountPaid, 0);
  const totalOutstanding = charges.reduce((s, c) => s + Math.max(0, c.amount - c.amountPaid), 0);

  return (
    <PortalShell tenantName={tenant.name} roomName={tenant.room?.name ?? null}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">One-time Charges</h1>
          <p className="text-sm text-slate-500 mt-0.5">{charges.length} charge{charges.length !== 1 ? "s" : ""} recorded</p>
        </div>

        {/* Summary */}
        {charges.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total charged</span>
              <span className="font-semibold text-slate-800">{fmt(totalCharged)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total paid</span>
              <span className="font-semibold text-emerald-700">{fmt(totalPaid)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
              <span className="text-slate-500">Outstanding</span>
              <span className={`font-bold ${totalOutstanding > 0 ? "text-rose-600" : "text-slate-800"}`}>
                {fmt(totalOutstanding)}
              </span>
            </div>
          </div>
        )}

        {/* Charges list */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {charges.length === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">No charges recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {charges.map(c => (
                <div key={c.id} className="px-4 py-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{c.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(c.date)}</p>
                      {c.notes && <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>}
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLES[c.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <p>Amount: <span className="font-medium text-slate-700">{fmt(c.amount)}</span></p>
                    {c.amountPaid > 0 && (
                      <p>Paid: <span className="font-medium text-emerald-700">{fmt(c.amountPaid)}</span></p>
                    )}
                    {c.amount - c.amountPaid > 0 && (
                      <p>Balance: <span className="font-medium text-rose-600">{fmt(c.amount - c.amountPaid)}</span></p>
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
