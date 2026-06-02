export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MoveOutButton } from "./move-out-button";
import { PaymentLedger } from "./payment-ledger";
import { pickRentForMonth } from "@/lib/rent-history";
import { getSettings } from "@/lib/settings";
import { ChevronRight, Phone, Mail, Home, Calendar, Shield, TrendingUp, AlertCircle, CheckCircle2, Sparkles, FileText } from "lucide-react";
import { TenantDocumentsPanel } from "./tenant-documents";
import { CollapsibleGroup } from "./collapsible-group";

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
    include: { room: { include: { recurringCharges: true, rentHistory: true } }, oneTimeCharges: { orderBy: { date: "desc" } } },
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

    // Clean up two kinds of phantom auto-generated rows (anything with
    // money applied — PAID / PARTIAL / manual entry — is preserved):
    //   1. Months before the (possibly moved-forward) move-in month.
    //   2. The current calendar month when the billing day hasn't passed
    //      yet — e.g. a "Jun 7 – Jul 7" row that lingered from before
    //      today, while today is Jun 1 and billing day is the 7th.
    //      Further-future rows (month > calCurrentMonth) are left alone
    //      so intentional pre-generation isn't destroyed.
    await prisma.payment.deleteMany({
      where: {
        userId:     user.id,
        tenantId:   tenantBase.id,
        amountPaid: 0,
        OR: [
          { month: { lt: moveInMonth } },
          { AND: [
              { month: { gt: lastMonthStr   } },
              { month: { lte: calCurrentMonth } },
            ],
          },
        ],
      },
    });

    const { pickRentForMonth } = await import("@/lib/rent-history");
    for (const m of monthRange(moveInMonth, lastMonthStr)) {
      const chargesForMonth = tenantBase.room.recurringCharges
        .filter(c => (c.tenantId === null || c.tenantId === tenantBase.id)
          && (!c.effectiveFrom || c.effectiveFrom <= m)
          && (!c.effectiveTo   || m <= c.effectiveTo))
        .reduce((s, c) => s + c.amount, 0);
      const rentForM   = pickRentForMonth(tenantBase.room.rentHistory, m, tenantBase.room.monthlyRent);
      const amountDue  = rentForM + chargesForMonth;

      const existing = await prisma.payment.findUnique({
        where:  { tenantId_month: { tenantId: tenantBase.id, month: m } },
        select: { id: true, amountPaid: true, status: true },
      });

      if (!existing) {
        await prisma.payment.create({
          data: { userId: user.id, tenantId: tenantBase.id, roomId: tenantBase.roomId, month: m, amountDue, amountPaid: 0, status: m < calCurrentMonth ? "OVERDUE" : "PENDING" },
        });
      } else if (existing.status !== "PAID") {
        // Refresh amountDue for any bill that isn't fully settled. PARTIAL
        // bills DO update so charge edits flow through; only PAID bills
        // (money received in full, receipt issued) stay locked.
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
      room: { include: { recurringCharges: { orderBy: { createdAt: "asc" } }, rentHistory: true } },
      payments: { orderBy: { month: "desc" }, include: { room: true } },
      oneTimeCharges: { orderBy: { date: "desc" } },
    },
  });

  if (!tenant) notFound();

  const settings     = await getSettings(user.id);
  const fmt          = (n: number) => formatCurrency(n, settings.currencySymbol);

  const isActive         = !tenant.moveOutDate;
  const totalCollected   = tenant.payments.reduce((sum, p) => sum + p.amountPaid, 0) + tenant.oneTimeCharges.reduce((sum, c) => sum + c.amountPaid, 0);
  const totalOutstanding = tenant.payments.reduce((sum, p) => sum + Math.max(0, p.amountDue - p.amountPaid), 0) + tenant.oneTimeCharges.reduce((sum, c) => sum + Math.max(0, c.amount - c.amountPaid), 0);
  const overdueCount = tenant.payments.filter(p => p.status === "OVERDUE").length;
  const totalBilled  = totalCollected + totalOutstanding;
  const outstandingPct = totalBilled > 0 ? Math.round((totalOutstanding / totalBilled) * 100) : 0;
  const collectedPct   = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${avatarColor} shadow-md flex items-center justify-center text-white text-base sm:text-lg font-black shrink-0`}>
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">{tenant.name}</h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                  isActive ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}>
                  {isActive ? "Active" : "Past Tenant"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                <span className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  <Phone size={12} className="text-slate-400" />
                  {tenant.phone}
                </span>
                {tenant.email && (
                  <span className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 min-w-0">
                    <Mail size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">{tenant.email}</span>
                  </span>
                )}
                {tenant.room && (
                  <Link href={`/rooms/${tenant.room.id}`} className="flex items-center gap-1.5 text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    <Home size={12} />
                    {tenant.room.name}
                  </Link>
                )}
                <span className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  <Calendar size={12} className="text-slate-400" />
                  Since {formatDate(tenant.moveInDate)}
                  {yearsWithUs >= 1 && (
                    <span className="flex items-center gap-0.5 text-violet-600 font-semibold text-[11px]">
                      <Sparkles size={10} />
                      {yearsWithUs}yr
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto sm:shrink-0">
            <Link href={`/tenants/${id}/edit`}
              className="flex-1 sm:flex-none text-center border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Edit
            </Link>
            {isActive && <MoveOutButton tenantId={id} moveInDate={tenant.moveInDate.toISOString()} />}
          </div>
        </div>
      </div>

      {/* Stat cards — both scroll to the Payment Ledger below. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <a href="#payment-ledger"
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-3 sm:p-5 block hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-500/40 transition-all cursor-pointer min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
              <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            {totalBilled > 0 && (
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                <span className="sm:hidden">{collectedPct}%</span>
                <span className="hidden sm:inline">{collectedPct}% collected</span>
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Total Collected</p>
          <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 sm:mt-1 tracking-tight truncate">{fmt(totalCollected)}</p>
          {tenant.payments.length > 0 && (
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">across {tenant.payments.length} month{tenant.payments.length !== 1 ? "s" : ""}</p>
          )}
        </a>

        <a href="#payment-ledger"
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-3 sm:p-5 block hover:shadow-md hover:border-rose-200 dark:hover:border-rose-500/40 transition-all cursor-pointer min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${totalOutstanding > 0 ? "bg-rose-50 dark:bg-rose-500/15" : "bg-emerald-50 dark:bg-emerald-500/15"}`}>
              {totalOutstanding > 0
                ? <AlertCircle size={14} className="text-rose-500 dark:text-rose-400" />
                : <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />}
            </div>
            {totalOutstanding > 0 && outstandingPct > 0 && (
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                <span className="sm:hidden">{outstandingPct}%</span>
                <span className="hidden sm:inline">{outstandingPct}% of billed</span>
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
          <p className={`text-lg sm:text-2xl font-black mt-0.5 sm:mt-1 tracking-tight truncate ${totalOutstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>{fmt(totalOutstanding)}</p>
          {overdueCount > 0 && (
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{overdueCount} overdue month{overdueCount !== 1 ? "s" : ""}</p>
          )}
        </a>
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

      {/* Details & Documents — reference info, tucked away by default */}
      <CollapsibleGroup
        title="Details & Documents"
        subtitle="Deposit, notes & uploaded files"
        icon={<FileText size={15} />}
      >
        {(tenant.deposit > 0 || tenant.moveOutDate || tenant.notes) && (
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
        <TenantDocumentsPanel tenantId={id} />
      </CollapsibleGroup>

      {/* Payment Ledger — full month-by-month view for this tenant. */}
      <div id="payment-ledger" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden scroll-mt-4">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-white text-sm">Payment Ledger</h2>
          <p className="text-xs text-slate-400 mt-0.5">{tenant.payments.length} month{tenant.payments.length !== 1 ? "s" : ""} recorded</p>
        </div>
        <PaymentLedger
          payments={tenant.payments.map(p => {
            // Match one-time charges to the rent period they fall in (not
            // calendar month). For a moveInDay of 7, a charge dated Jun 01
            // belongs to the "May 7 – Jun 7" period (p.month "2026-05"),
            // not to "2026-06". This is the rule that keeps Outstanding =
            // ledger total even for next-month meter readings.
            const moveInDay = tenant.moveInDate.getDate();
            const otcForMonth = tenant.oneTimeCharges.filter(c => {
              const d  = new Date(c.date);
              const dd = d.getDate();
              let yy   = d.getFullYear();
              let mm   = d.getMonth() + 1;
              if (dd < moveInDay) { mm--; if (mm < 1) { mm = 12; yy--; } }
              const k = `${yy}-${String(mm).padStart(2, "0")}`;
              return k === p.month;
            });
            const recurringForMonth = tenant.room ? tenant.room.recurringCharges
              .filter(c => (c.tenantId === null || c.tenantId === tenant.id)
                && (!c.effectiveFrom || c.effectiveFrom <= p.month)
                && (!c.effectiveTo   || p.month <= c.effectiveTo))
              .map(c => ({ title: c.title, amount: c.amount })) : [];
            return {
              id:         p.id,
              month:      p.month,
              amountDue:  p.amountDue,
              amountPaid: p.amountPaid,
              paidDate:   p.paidDate?.toISOString() ?? null,
              method:     p.method,
              status:     p.status,
              notes:      p.notes,
              extraDue:   otcForMonth.reduce((s, c) => s + c.amount,     0),
              extraPaid:  otcForMonth.reduce((s, c) => s + c.amountPaid, 0),
              breakdown: tenant.room ? {
                baseRent: pickRentForMonth(tenant.room.rentHistory, p.month, tenant.room.monthlyRent),
                charges:  [
                  ...recurringForMonth,
                  ...otcForMonth.map(c => ({ title: c.title, amount: c.amount })),
                ],
              } : undefined,
            };
          })}
          currencySymbol={settings.currencySymbol}
          isPro={pro}
          tenantPhone={tenant.phone}
          whatsappNotify={tenant.whatsappNotify}
          moveInDay={tenant.moveInDate.getDate()}
        />
      </div>
    </div>
  );
}
