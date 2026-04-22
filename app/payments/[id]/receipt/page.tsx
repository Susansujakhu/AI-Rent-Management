export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatRentalPeriod } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/print-button";
import { ArrowLeft, Building2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { requireAuth } = await import("@/lib/auth");
  const user = await requireAuth();

  const payment = await prisma.payment.findUnique({
    where: { id, userId: user.id },
    include: { tenant: true, room: true },
  });
  if (!payment) notFound();

  const settings = await getSettings(user.id);
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);
  const balance = payment.amountDue - payment.amountPaid;

  // ── Find the latest session this payment was paid in ─────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentTxns = await (prisma as any).paymentTransaction.findMany({
    where:   { paymentId: id },
    orderBy: { paidAt: "desc" },
    select:  { amount: true, creditAmount: true, totalEntered: true, paidAt: true },
  }) as Array<{ amount: number; creditAmount: number; totalEntered: number; paidAt: Date }>;

  const latestTxn = paymentTxns[0];

  // ── Charge transactions paid in the same session ──────────────────────────────
  type ChargeTxn = { chargeTitle: string; amount: number };
  let chargeTxns: ChargeTxn[] = [];
  let sessionTotal = payment.amountPaid;

  if (latestTxn) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chargeTxns = await (prisma as any).chargeTransaction.findMany({
      where:   { userId: user.id, tenantId: payment.tenantId, paidAt: latestTxn.paidAt },
      select:  { chargeTitle: true, amount: true },
      orderBy: { createdAt: "asc" },
    }) as ChargeTxn[];

    const chargesTotal = chargeTxns.reduce((s, c) => s + c.amount, 0);
    sessionTotal = (latestTxn.totalEntered > 0)
      ? latestTxn.totalEntered
      : latestTxn.amount + (latestTxn.creditAmount ?? 0) + chargesTotal;
  }

  const hasCharges    = chargeTxns.length > 0;
  const showTotal     = hasCharges;

  const statusConfig = {
    PAID:    { label: "PAID IN FULL",    icon: CheckCircle2, bg: "bg-emerald-500", light: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    PARTIAL: { label: "PARTIALLY PAID", icon: Clock,         bg: "bg-blue-500",    light: "bg-blue-50 border-blue-200 text-blue-700" },
    PENDING: { label: "PENDING",         icon: Clock,         bg: "bg-amber-500",   light: "bg-amber-50 border-amber-200 text-amber-700" },
    OVERDUE: { label: "OVERDUE",         icon: AlertTriangle, bg: "bg-rose-500",    light: "bg-rose-50 border-rose-200 text-rose-700" },
  };
  const sc = statusConfig[payment.status as keyof typeof statusConfig] ?? statusConfig.PENDING;
  const StatusIcon = sc.icon;

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } .print-card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; } }`}</style>

      <div className="max-w-lg mx-auto space-y-4">
        {/* Nav — hidden on print */}
        <div className="no-print flex items-center justify-between">
          <Link href={`/tenants/${payment.tenantId}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft size={15} /> Back to tenant
          </Link>
          <PrintButton />
        </div>

        {/* Receipt card */}
        <div className="print-card bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Color header strip */}
          <div className={`${sc.bg} px-8 py-5 text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Building2 size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-white/70">Rent Manager</p>
                  <p className="font-bold text-white text-sm">Official Receipt</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60 font-medium">Receipt No.</p>
                <p className="font-mono font-bold text-white text-sm">#{id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* Month + Status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Billing Period</p>
                <p className="text-xl font-black text-slate-900 mt-0.5">{formatRentalPeriod(payment.month, payment.tenant.moveInDate.getDate())}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${sc.light}`}>
                <StatusIcon size={12} />
                {sc.label}
              </span>
            </div>

            <hr className="border-slate-100" />

            {/* Parties */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tenant</p>
                <p className="font-bold text-slate-900">{payment.tenant.name}</p>
                <p className="text-sm text-slate-500 mt-0.5">{payment.tenant.phone}</p>
                {payment.tenant.email && <p className="text-sm text-slate-400">{payment.tenant.email}</p>}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Property</p>
                <p className="font-bold text-slate-900">{payment.room.name}</p>
                {payment.room.floor && <p className="text-sm text-slate-500 mt-0.5">{payment.room.floor} Floor</p>}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Payment Details */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Details</p>
              <div className="bg-slate-50 rounded-xl overflow-hidden">
                <div className="divide-y divide-white">
                  {/* Monthly rent */}
                  <div className="flex justify-between px-4 py-3 text-sm">
                    <span className="text-slate-500">Monthly Rent</span>
                    <span className="font-semibold text-slate-800">{fmt(payment.amountDue)}</span>
                  </div>
                  {/* Rent applied */}
                  <div className="flex justify-between px-4 py-3 text-sm">
                    <span className="text-slate-500">{hasCharges ? "Applied to Rent" : "Amount Received"}</span>
                    <span className="font-bold text-emerald-700">{fmt(payment.amountPaid)}</span>
                  </div>
                  {/* One-time charge lines */}
                  {chargeTxns.map((c, i) => (
                    <div key={i} className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        {c.chargeTitle}
                        <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full leading-none">charge</span>
                      </span>
                      <span className="font-semibold text-slate-800">{fmt(c.amount)}</span>
                    </div>
                  ))}
                  {/* Session total — only shown when charges are included */}
                  {showTotal && (
                    <div className="flex justify-between px-4 py-3 text-sm bg-slate-100/60">
                      <span className="font-bold text-slate-700">Total Received</span>
                      <span className="font-black text-slate-900">{fmt(sessionTotal)}</span>
                    </div>
                  )}
                  {payment.method && (
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-slate-500">Payment Method</span>
                      <span className="font-semibold text-slate-800">{payment.method}</span>
                    </div>
                  )}
                  {payment.paidDate && (
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-slate-500">Date Received</span>
                      <span className="font-semibold text-slate-800">{formatDate(payment.paidDate)}</span>
                    </div>
                  )}
                  {balance > 0 && (
                    <div className="flex justify-between px-4 py-3 text-sm bg-rose-50">
                      <span className="text-rose-600 font-semibold">Outstanding Balance</span>
                      <span className="font-black text-rose-700">{fmt(balance)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-slate-400 pt-2 border-t border-slate-100">
              Generated on {formatDate(new Date())} · Rent Manager
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
