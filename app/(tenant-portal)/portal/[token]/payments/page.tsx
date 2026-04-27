export const dynamic = "force-dynamic";

import { requireTenantByToken } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatRentalPeriod } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { PortalShell } from "../../_components/portal-shell";
import Link from "next/link";
import { FileText, QrCode } from "lucide-react";
import { existsSync } from "fs";
import { join } from "path";

const STATUS_STYLES: Record<string, string> = {
  PAID:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTIAL: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  OVERDUE: "bg-rose-50 text-rose-700 border-rose-200",
};

export default async function PortalPaymentsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tenant    = await requireTenantByToken(token);
  const settings      = await getSettings(tenant.userId);
  const allSettings   = await prisma.setting.findMany({ where: { userId: tenant.userId } });
  const settingsMap: Record<string, string> = {};
  for (const r of allSettings) settingsMap[r.key] = r.value;

  const esewaId    = settingsMap["esewaId"]    || null;
  const khaltiId   = settingsMap["khaltiId"]   || null;
  const fonepayId  = settingsMap["fonepayId"]  || null;
  const paymentNote = settingsMap["paymentNote"] || null;

  const QR_DIR = join(process.cwd(), "storage", "payment-qr");
  const esewaQR   = existsSync(join(QR_DIR, `${tenant.userId}-esewa.png`));
  const khaltiQR  = existsSync(join(QR_DIR, `${tenant.userId}-khalti.png`));
  const fonepayQR = existsSync(join(QR_DIR, `${tenant.userId}-fonepay.png`));
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentsRaw = await (prisma as any).payment.findMany({
    where:   { tenantId: tenant.id },
    orderBy: { month: "desc" },
    include: {
      room: { select: { name: true } },
      transactions: { select: { amount: true, creditAmount: true } },
    },
  }) as any[];

  const payments = paymentsRaw.map((p: any) => ({
    ...p,
    totalReceived:   p.transactions.reduce((s: number, t: any) => s + t.amount + (t.creditAmount ?? 0), 0),
    creditGenerated: p.transactions.reduce((s: number, t: any) => s + (t.creditAmount ?? 0), 0),
  }));

  const totalDue     = payments.reduce((s, p) => s + p.amountDue, 0);
  const totalPaid    = payments.reduce((s, p) => s + p.amountPaid, 0);
  const overdueCount = payments.filter(p => p.status === "OVERDUE").length;

  const qrBase = `/api/portal/payment-qr?t=${encodeURIComponent(token)}`;

  return (
    <PortalShell tenantName={tenant.name} roomName={tenant.room?.name ?? null} showElectricity={tenant.canSubmitMeterReading} token={token}>
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

        {/* Pay Online section */}
        {(esewaQR || khaltiQR || fonepayQR || esewaId || khaltiId || fonepayId) && (
          <div className="bg-white rounded-2xl border border-teal-100 overflow-hidden">
            <div className="px-4 py-3.5 border-b border-teal-50 flex items-center gap-2">
              <QrCode size={15} className="text-teal-600" />
              <h2 className="text-sm font-bold text-slate-800">Pay Online</h2>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
                {(esewaQR || esewaId) && (
                  <div className="text-center">
                    {esewaQR && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${qrBase}&type=esewa`} alt="eSewa QR" className="w-28 h-28 rounded-xl border border-slate-100 mx-auto object-contain" />
                    )}
                    <p className="text-xs font-bold text-emerald-700 mt-1.5">eSewa</p>
                    {esewaId && <p className="text-[11px] text-slate-400">{esewaId}</p>}
                  </div>
                )}
                {(khaltiQR || khaltiId) && (
                  <div className="text-center">
                    {khaltiQR && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${qrBase}&type=khalti`} alt="Khalti QR" className="w-28 h-28 rounded-xl border border-slate-100 mx-auto object-contain" />
                    )}
                    <p className="text-xs font-bold text-violet-700 mt-1.5">Khalti</p>
                    {khaltiId && <p className="text-[11px] text-slate-400">{khaltiId}</p>}
                  </div>
                )}
                {(fonepayQR || fonepayId) && (
                  <div className="text-center">
                    {fonepayQR && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${qrBase}&type=fonepay`} alt="FonePay QR" className="w-28 h-28 rounded-xl border border-slate-100 mx-auto object-contain" />
                    )}
                    <p className="text-xs font-bold text-blue-700 mt-1.5">FonePay</p>
                    {fonepayId && <p className="text-[11px] text-slate-400">{fonepayId}</p>}
                  </div>
                )}
              </div>
              {paymentNote && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5 leading-relaxed">{paymentNote}</p>
              )}
            </div>
          </div>
        )}

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
                      <p className="font-semibold text-slate-800 text-sm">{formatRentalPeriod(p.month, tenant.moveInDate.getDate())}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.room.name}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLES[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <p>Due: <span className="font-medium text-slate-700">{fmt(p.amountDue)}</span></p>
                      {p.totalReceived > 0 ? (
                        <p>
                          Paid:{" "}
                          <span className="font-medium text-slate-700">{fmt(p.totalReceived)}</span>
                          {p.creditGenerated > 0 && (
                            <span className="ml-1.5 text-emerald-600 font-medium">
                              (+{fmt(p.creditGenerated)} credit)
                            </span>
                          )}
                        </p>
                      ) : (
                        <p>Paid: <span className="font-medium text-slate-700">{fmt(p.amountPaid)}</span></p>
                      )}
                      {p.status === "PARTIAL" && (
                        <p className="text-amber-600">Applied: {fmt(p.amountPaid)} of {fmt(p.amountDue)}</p>
                      )}
                      {p.paidDate && <p>On: {formatDate(p.paidDate)}</p>}
                      {p.method && <p className="uppercase">{p.method}</p>}
                    </div>
                    {p.amountPaid > 0 && (
                      <Link
                        href={`/portal/${token}/payments/${p.id}/receipt`}
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
