export const dynamic = "force-dynamic";

import { requireTenantPage } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { PortalShell } from "../_components/portal-shell";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Home, Calendar, ArrowRight, TrendingUp } from "lucide-react";

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string; icon: typeof CheckCircle2; label: string }> = {
  PAID:    { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", icon: CheckCircle2, label: "Paid" },
  PARTIAL: { color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",       dot: "bg-blue-500",    icon: Clock,        label: "Partially Paid" },
  PENDING: { color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     dot: "bg-amber-400",   icon: Clock,        label: "Due" },
  OVERDUE: { color: "text-rose-700",    bg: "bg-rose-50 border-rose-200",       dot: "bg-rose-500",    icon: AlertCircle,  label: "Overdue" },
};

export default async function PortalDashboard() {
  const session  = await requireTenantPage();
  const tenant   = session.tenant;
  const settings = await getSettings();
  const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);

  const allPayments = await prisma.payment.findMany({
    where:   { tenantId: tenant.id },
    orderBy: { month: "desc" },
    include: { room: { select: { name: true } } },
  });

  const totalPaid        = allPayments.reduce((s, p) => s + p.amountPaid, 0);
  const totalOutstanding = allPayments.reduce((s, p) => s + Math.max(0, p.amountDue - p.amountPaid), 0);
  const totalDue         = allPayments.reduce((s, p) => s + p.amountDue, 0);
  const overduePayments  = allPayments.filter(p => p.status === "OVERDUE");
  const unpaidPayments   = allPayments.filter(p => p.status !== "PAID").slice(0, 5);
  const recentPaid       = allPayments.filter(p => p.amountPaid > 0).slice(0, 3);

  return (
    <PortalShell tenantName={tenant.name} roomName={tenant.room?.name ?? null}>
      <div className="space-y-5">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-black text-slate-900">Hello, {tenant.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-slate-400 mt-0.5">Here&apos;s your rent summary</p>
        </div>

        {/* ── HERO: Total Outstanding ─────────────────────────────── */}
        <div className={`rounded-2xl p-5 border ${
          totalOutstanding > 0
            ? "bg-gradient-to-br from-rose-500 to-rose-600 border-rose-400 shadow-lg shadow-rose-200/60"
            : "bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400 shadow-lg shadow-emerald-200/60"
        }`}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">
            Total Outstanding
          </p>
          <p className="text-4xl font-black text-white tracking-tight">
            {fmt(totalOutstanding)}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-white/70">
              <span>Charged <span className="font-bold text-white">{fmt(totalDue)}</span></span>
              <span>Paid <span className="font-bold text-white">{fmt(totalPaid)}</span></span>
            </div>
            {totalOutstanding === 0 && (
              <span className="flex items-center gap-1 text-xs font-bold text-white/90 bg-white/20 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={11} /> All clear
              </span>
            )}
          </div>
        </div>

        {/* ── Overdue alert ───────────────────────────────────────── */}
        {overduePayments.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={17} className="text-rose-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-rose-800">
                {overduePayments.length} overdue payment{overduePayments.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-rose-500 mt-0.5">Contact your landlord to clear overdue dues.</p>
            </div>
          </div>
        )}

        {/* ── Advance credit ──────────────────────────────────────── */}
        {tenant.creditBalance > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-teal-800">Advance Credit</p>
              <p className="text-xs text-teal-500 mt-0.5">Auto-applies to upcoming dues</p>
            </div>
            <p className="text-xl font-black text-teal-700">{fmt(tenant.creditBalance)}</p>
          </div>
        )}

        {/* ── Pending / Unpaid months ─────────────────────────────── */}
        {unpaidPayments.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Pending Payments</h2>
              <Link href="/portal/payments" className="text-xs text-teal-600 font-semibold hover:text-teal-700 flex items-center gap-1">
                View all <ArrowRight size={11} />
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {unpaidPayments.map(p => {
                const cfg = STATUS_CONFIG[p.status];
                const balance = p.amountDue - p.amountPaid;
                return (
                  <div key={p.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg?.dot ?? "bg-slate-300"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{formatMonth(p.month)}</p>
                        <p className="text-xs text-slate-400">{p.room.name}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-rose-600">{fmt(balance)}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg?.bg ?? ""} ${cfg?.color ?? ""}`}>
                        {cfg?.label ?? p.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stats row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
              <TrendingUp size={15} className="text-emerald-600" />
            </div>
            <p className="text-xs text-slate-400 font-medium">Total Paid</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{fmt(totalPaid)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center mb-2">
              <CheckCircle2 size={15} className="text-slate-400" />
            </div>
            <p className="text-xs text-slate-400 font-medium">Months Recorded</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{allPayments.length}</p>
          </div>
        </div>

        {/* ── Recent paid payments ────────────────────────────────── */}
        {recentPaid.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Recently Paid</h2>
              <Link href="/portal/payments" className="text-xs text-teal-600 font-semibold hover:text-teal-700 flex items-center gap-1">
                All payments <ArrowRight size={11} />
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {recentPaid.map(p => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{formatMonth(p.month)}</p>
                    <p className="text-xs text-slate-400">{fmt(p.amountPaid)} paid{p.paidDate ? ` · ${formatDate(p.paidDate)}` : ""}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={10} /> Paid
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tenancy info ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Tenancy</h2>
          {tenant.room && (
            <div className="flex items-center gap-2.5 text-sm">
              <Home size={14} className="text-slate-400" />
              <span className="text-slate-700 font-medium">{tenant.room.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 text-sm">
            <Calendar size={14} className="text-slate-400" />
            <span className="text-slate-600">Since {formatDate(tenant.moveInDate)}</span>
          </div>
          {tenant.deposit > 0 && (
            <div className="flex justify-between text-sm pt-2 border-t border-slate-50">
              <span className="text-slate-400">Security Deposit</span>
              <span className="font-bold text-slate-700">{fmt(tenant.deposit)}</span>
            </div>
          )}
        </div>

      </div>
    </PortalShell>
  );
}
