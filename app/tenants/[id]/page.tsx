export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MoveOutButton } from "./move-out-button";
import { WhatsAppToggle } from "./whatsapp-toggle";
import { ElectricityMeterToggle } from "./electricity-meter-toggle";
import { TenantRecurringChargesPanel } from "./tenant-recurring-charges";
import { PortalAccessCard } from "./portal-access";
import { PaymentLedger } from "./payment-ledger";
import { OneTimeChargesPanel } from "./one-time-charges-panel";
import { getSettings } from "@/lib/settings";
import { ChevronRight, Phone, Mail, Home, Calendar, Shield, TrendingUp, AlertCircle, Sparkles, MessageCircle } from "lucide-react";
import { TenantDocumentsPanel } from "./tenant-documents";

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
    PAID:    "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20",
    PARTIAL: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20",
    PENDING: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20",
    OVERDUE: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20",
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

const AVATAR_COLORS = [
  "from-violet-400 to-violet-600",
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-orange-400 to-orange-600",
  "from-rose-400 to-rose-600",
  "from-indigo-400 to-indigo-600",
];

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { requireAuth } = await import("@/lib/auth");
  const { isPro } = await import("@/lib/plan");
  const user = await requireAuth();
  const pro  = isPro(user);

  const tenantBase = await prisma.tenant.findUnique({
    where: { id, userId: user.id },
    include: { room: { include: { recurringCharges: true } }, oneTimeCharges: { orderBy: { date: "desc" } } },
  });

  if (!tenantBase) notFound();

  if (!tenantBase.moveOutDate && tenantBase.room && tenantBase.roomId) {
    const today       = new Date();
    const todayDay    = today.getDate();
    const moveInDate  = tenantBase.moveInDate;
    const moveInDay   = moveInDate.getDate();
    const daysInCurMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const effectiveBillingDay = Math.min(moveInDay, daysInCurMonth);
    let lastYear  = today.getFullYear();
    let lastMonth = today.getMonth() + 1;
    if (todayDay < effectiveBillingDay) {
      lastMonth--;
      if (lastMonth < 1) { lastMonth = 12; lastYear--; }
    }
    const lastMonthStr    = monthString(lastYear, lastMonth);
    const calCurrentMonth = monthString(today.getFullYear(), today.getMonth() + 1);
    const moveInMonth     = monthString(moveInDate.getFullYear(), moveInDate.getMonth() + 1);
    for (const m of monthRange(moveInMonth, lastMonthStr)) {
      const chargesForMonth = tenantBase.room.recurringCharges
        .filter(c => (c.tenantId === null || c.tenantId === tenantBase.id) && (!c.effectiveFrom || c.effectiveFrom <= m))
        .reduce((s, c) => s + c.amount, 0);
      const baseAmount = tenantBase.room.monthlyRent + chargesForMonth;

      const amountDue = baseAmount;

      const existing = await prisma.payment.findUnique({
        where: { tenantId_month: { tenantId: tenantBase.id, month: m } },
        select: { id: true, status: true },
      });

      if (!existing) {
        await prisma.payment.create({
          data: { userId: user.id, tenantId: tenantBase.id, roomId: tenantBase.roomId, month: m, amountDue, amountPaid: 0, status: m < calCurrentMonth ? "OVERDUE" : "PENDING" },
        });
      } else if (existing.status !== "PAID") {
        await prisma.payment.update({ where: { id: existing.id }, data: { amountDue } });
      }
    }
  }

  if (tenantBase.creditBalance > 0) {
    const unpaid = await prisma.payment.findMany({
      where:   { userId: user.id, tenantId: tenantBase.id, status: { not: "PAID" } },
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
    where: { id, userId: user.id },
    include: {
      room: { include: { recurringCharges: { orderBy: { createdAt: "asc" } } } },
      payments: { orderBy: { month: "desc" }, include: { room: true } },
      oneTimeCharges: { orderBy: { date: "desc" } },
    },
  });

  if (!tenant) notFound();

  const settings = await getSettings(user.id);
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  const isActive         = !tenant.moveOutDate;
  const totalCollected   = tenant.payments.reduce((sum, p) => sum + p.amountPaid, 0) + tenant.oneTimeCharges.reduce((sum, c) => sum + c.amountPaid, 0);
  const totalOutstanding = tenant.payments.reduce((sum, p) => sum + Math.max(0, p.amountDue - p.amountPaid), 0) + tenant.oneTimeCharges.reduce((sum, c) => sum + Math.max(0, c.amount - c.amountPaid), 0);
  const overdueCount = tenant.payments.filter(p => p.status === "OVERDUE").length;

  const avatarColor = AVATAR_COLORS[tenant.name.charCodeAt(0) % AVATAR_COLORS.length];
  const initials = tenant.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  // Move-in anniversary
  const now = new Date();
  const yearsWithUs = now.getFullYear() - tenant.moveInDate.getFullYear();

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/tenants" className="hover:text-slate-600 transition-colors">Tenants</Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 font-medium">{tenant.name}</span>
      </div>

      {/* Hero card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className={`bg-gradient-to-r ${avatarColor} h-20 relative`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute bottom-0 right-4 translate-y-1/2">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor} shadow-lg border-4 border-white dark:border-slate-900 flex items-center justify-center text-white text-xl font-black`}>
              {initials}
            </div>
          </div>
        </div>
        <div className="px-5 pt-10 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{tenant.name}</h1>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                  isActive ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}>
                  {isActive ? "Active" : "Past Tenant"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2.5">
                <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <Phone size={13} className="text-slate-400" />
                  {tenant.phone}
                </span>
                {tenant.email && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <Mail size={13} className="text-slate-400" />
                    {tenant.email}
                  </span>
                )}
                {tenant.room && (
                  <Link href={`/rooms/${tenant.room.id}`} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    <Home size={13} />
                    {tenant.room.name}
                  </Link>
                )}
                <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <Calendar size={13} className="text-slate-400" />
                  Since {formatDate(tenant.moveInDate)}
                  {yearsWithUs >= 1 && (
                    <span className="flex items-center gap-0.5 text-violet-600 font-semibold text-xs">
                      <Sparkles size={11} />
                      {yearsWithUs}yr
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href={`/tenants/${id}/edit`}
                className="border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Edit
              </Link>
              {isActive && <MoveOutButton tenantId={id} moveInDate={tenant.moveInDate.toISOString()} />}
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-sm shadow-emerald-200 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mb-3">
            <TrendingUp size={15} className="text-white" />
          </div>
          <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Total Collected</p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">{fmt(totalCollected)}</p>
        </div>

        <div className={`rounded-2xl shadow-sm p-5 relative overflow-hidden ${
          totalOutstanding > 0
            ? "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-200"
            : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
        }`}>
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${totalOutstanding > 0 ? "bg-white/20" : "bg-rose-50"}`}>
            <AlertCircle size={15} className={totalOutstanding > 0 ? "text-white" : "text-rose-500"} />
          </div>
          <p className={`text-xs font-bold uppercase tracking-wider ${totalOutstanding > 0 ? "text-rose-100" : "text-slate-400"}`}>Outstanding</p>
          <p className={`text-2xl font-black mt-1 tracking-tight ${totalOutstanding > 0 ? "text-white" : "text-rose-600"}`}>{fmt(totalOutstanding)}</p>
          {overdueCount > 0 && (
            <p className="text-xs text-rose-100 mt-0.5">{overdueCount} overdue month{overdueCount !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>

      {/* Advance credit */}
      {tenant.creditBalance > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
              <Shield size={15} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Advance Credit</p>
              <p className="text-xs text-indigo-500 dark:text-indigo-400">Will auto-apply to next payment</p>
            </div>
          </div>
          <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">{fmt(tenant.creditBalance)}</p>
        </div>
      )}

      {/* WhatsApp notification toggle */}
      <WhatsAppToggle tenantId={id} enabled={tenant.whatsappNotify} />

      {/* Electricity meter reading toggle */}
      {process.env.TENANT_PORTAL_ENABLED === "true" && (
        <ElectricityMeterToggle
          tenantId={id}
          canSubmit={tenant.canSubmitMeterReading}
          autoAccept={tenant.meterReadingAutoAccept}
        />
      )}

      {/* Tenant Portal Access */}
      {process.env.TENANT_PORTAL_ENABLED === "true" && (
        <PortalAccessCard
          tenantId={id}
          tenantName={tenant.name}
          tenantPhone={tenant.phone}
          portalEnabled={tenant.portalEnabled}
          portalToken={tenant.portalToken ?? null}
          isPro={pro}
        />
      )}

      {/* Contact info card */}
      {(tenant.deposit > 0 || tenant.notes) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Details</h2>
          <div className="space-y-2.5 text-sm divide-y divide-slate-50 dark:divide-slate-800">
            {tenant.deposit > 0 && (
              <div className="flex justify-between pt-2 first:pt-0">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Security Deposit</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{fmt(tenant.deposit)}</span>
              </div>
            )}
            {tenant.moveOutDate && (
              <div className="flex justify-between pt-2 first:pt-0">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Move-out Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(tenant.moveOutDate)}</span>
              </div>
            )}
            {tenant.notes && (
              <div className="pt-2 first:pt-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{tenant.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-white text-sm">Payment Ledger</h2>
          <p className="text-xs text-slate-400 mt-0.5">{tenant.payments.length} months recorded</p>
        </div>
        <PaymentLedger
          payments={tenant.payments.map(p => ({
            id:        p.id,
            month:     p.month,
            amountDue: p.amountDue,
            amountPaid: p.amountPaid,
            paidDate:  p.paidDate?.toISOString() ?? null,
            method:    p.method,
            status:    p.status,
            notes:     p.notes,
          }))}
          currencySymbol={settings.currencySymbol}
          isPro={pro}
          tenantPhone={tenant.phone}
          whatsappNotify={tenant.whatsappNotify}
          moveInDay={tenant.moveInDate.getDate()}
        />
      </div>

      {/* One-time Charges */}
      <OneTimeChargesPanel
        tenantId={id}
        charges={tenant.oneTimeCharges.map(c => ({
          id:        c.id,
          title:     c.title,
          amount:    c.amount,
          amountPaid: c.amountPaid,
          date:      c.date.toISOString(),
          status:    c.status,
          notes:     c.notes,
        }))}
        currencySymbol={settings.currencySymbol}
        isActive={isActive}
      />

      {/* Documents */}
      <TenantDocumentsPanel tenantId={id} />
    </div>
  );
}
