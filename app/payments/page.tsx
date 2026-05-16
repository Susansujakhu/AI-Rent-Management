export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { currentMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { isPro } from "@/lib/plan";
import { PaymentsView, type ReceivedSession, type OpenBill } from "@/components/payments-view";
import { GeneratePaymentsButton } from "@/components/generate-payments-button";

export default async function PaymentsPage() {
  const { requireAuth } = await import("@/lib/auth");
  const user     = await requireAuth();
  const settings = await getSettings(user.id);

  // ── All transactions → group into received sessions ────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTxns = await (prisma as any).paymentTransaction.findMany({
    where:   { userId: user.id },
    include: { payment: { include: { tenant: true, room: true } } },
    orderBy: { paidAt: "desc" },
  }) as Array<{
    id: string; amount: number; creditAmount: number; totalEntered: number;
    method: string | null; paidAt: Date; note: string | null;
    payment: {
      id: string; month: string; status: string; amountDue: number; amountPaid: number;
      tenantId: string;
      tenant: { id: string; name: string; phone: string | null; whatsappNotify: boolean; moveInDate: Date | null };
      room: { name: string };
    };
  }>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawChargeTxns = await (prisma as any).chargeTransaction.findMany({
    where:   { userId: user.id },
    include: { charge: { select: { amount: true, amountPaid: true, status: true } }, tenant: { select: { id: true, name: true, phone: true, whatsappNotify: true } } },
    orderBy: { paidAt: "desc" },
  }) as Array<{
    id: string; tenantId: string; chargeId: string; chargeTitle: string;
    amount: number; method: string | null; paidAt: Date; note: string | null;
    charge: { amount: number; amountPaid: number; status: string };
    tenant: { id: string; name: string; phone: string | null; whatsappNotify: boolean };
  }>;

  // Legacy: paid payments that have no PaymentTransaction records (recorded before transaction tracking)
  const legacyPayments = await prisma.payment.findMany({
    where:   { userId: user.id, amountPaid: { gt: 0 }, transactions: { none: {} } },
    include: { tenant: true, room: true },
    orderBy: { paidDate: "desc" },
  });

  // Legacy: paid charges that have no ChargeTransaction records
  const legacyCharges = await prisma.oneTimeCharge.findMany({
    where:   { userId: user.id, amountPaid: { gt: 0 }, transactions: { none: {} } },
    include: { tenant: true },
    orderBy: { date: "desc" },
  });

  // Track which session keys have a PaymentTransaction (for total calculation)
  const sessionKeysWithPaymentTxn = new Set(rawTxns.map(t => `${t.payment.tenantId}_${t.paidAt.toISOString()}`));

  // Group by tenant + paidAt into sessions
  const sessionMap = new Map<string, ReceivedSession>();

  // First pass: PaymentTransactions (rent months)
  for (const t of rawTxns) {
    const key = `${t.payment.tenantId}_${t.paidAt.toISOString()}`;
    const moveInDay = t.payment.tenant.moveInDate ? new Date(t.payment.tenant.moveInDate).getDate() : 1;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        key,
        tenantId:       t.payment.tenant.id,
        tenantName:     t.payment.tenant.name,
        tenantPhone:    t.payment.tenant.phone,
        whatsappNotify: t.payment.tenant.whatsappNotify,
        paidAt:         t.paidAt.toISOString(),
        method:         t.method,
        // totalEntered on initiating txn covers the full cash (incl. one-time charges)
        // fall back to summing amounts if legacy record without totalEntered
        total:          (t.totalEntered ?? 0) > 0 ? t.totalEntered : t.amount + (t.creditAmount ?? 0),
        lines:          [],
      });
    }
    const s = sessionMap.get(key)!;
    // If a later txn has totalEntered set, use it (it's the initiating one)
    if ((t.totalEntered ?? 0) > 0) s.total = t.totalEntered;
    else if (!(rawTxns.some(x => `${x.payment.tenantId}_${x.paidAt.toISOString()}` === key && (x.totalEntered ?? 0) > 0))) {
      s.total += t.amount + (t.creditAmount ?? 0);
    }
    s.lines.push({
      type:         "payment",
      paymentId:    t.payment.id,
      label:        `${t.payment.room.name} · ${formatRentalPeriodServer(t.payment.month, moveInDay)}`,
      amount:       t.amount,
      creditAmount: t.creditAmount ?? 0,
      status:       t.payment.status,
      amountDue:    t.payment.amountDue,
      amountPaid:   t.payment.amountPaid,
    });
  }

  // Second pass: ChargeTransactions — add as lines, create sessions for standalone charge payments
  for (const ct of rawChargeTxns) {
    const key = `${ct.tenantId}_${ct.paidAt.toISOString()}`;
    if (!sessionMap.has(key)) {
      // Standalone charge payment (not part of a rent payment session)
      sessionMap.set(key, {
        key,
        tenantId:       ct.tenant.id,
        tenantName:     ct.tenant.name,
        tenantPhone:    ct.tenant.phone,
        whatsappNotify: ct.tenant.whatsappNotify,
        paidAt:         ct.paidAt.toISOString(),
        method:         ct.method,
        total:          0,  // accumulated below
        lines:          [],
      });
    }
    const s = sessionMap.get(key)!;
    s.lines.push({
      type:         "charge",
      chargeId:     ct.chargeId,
      label:        ct.chargeTitle,
      amount:       ct.amount,
      creditAmount: 0,
      status:       ct.charge.status,
      amountDue:    ct.charge.amount,
      amountPaid:   ct.charge.amountPaid,
    });
    // Only add to total for charge-only sessions (mixed sessions use totalEntered from PaymentTransaction)
    if (!sessionKeysWithPaymentTxn.has(key)) {
      s.total += ct.amount;
    }
  }

  // Third pass: legacy payments (paid before transaction tracking was added)
  for (const p of legacyPayments) {
    const ts = p.paidDate ?? p.updatedAt;
    // Group by tenant + date-only (legacy records don't have precise time, use date string)
    const dateStr = ts.toISOString().slice(0, 10);
    const key = `legacy_${p.tenantId}_${dateStr}`;
    const moveInDay = p.tenant.moveInDate ? new Date(p.tenant.moveInDate).getDate() : 1;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        key,
        tenantId:       p.tenant.id,
        tenantName:     p.tenant.name,
        tenantPhone:    p.tenant.phone,
        whatsappNotify: p.tenant.whatsappNotify,
        paidAt:         ts.toISOString(),
        method:         p.method,
        total:          0,
        lines:          [],
      });
    }
    const s = sessionMap.get(key)!;
    s.total += p.amountPaid;
    s.lines.push({
      type:         "payment",
      paymentId:    p.id,
      label:        `${p.room.name} · ${formatRentalPeriodServer(p.month, moveInDay)}`,
      amount:       p.amountPaid,
      creditAmount: 0,
      status:       p.status,
      amountDue:    p.amountDue,
      amountPaid:   p.amountPaid,
    });
  }

  // Fourth pass: legacy charges (paid before ChargeTransaction tracking was added)
  for (const c of legacyCharges) {
    const dateStr = c.date.toISOString().slice(0, 10);
    const key = `legacy_charge_${c.tenantId}_${dateStr}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        key,
        tenantId:       c.tenant.id,
        tenantName:     c.tenant.name,
        tenantPhone:    c.tenant.phone,
        whatsappNotify: c.tenant.whatsappNotify,
        paidAt:         c.date.toISOString(),
        method:         null,
        total:          0,
        lines:          [],
      });
    }
    const s = sessionMap.get(key)!;
    s.total += c.amountPaid;
    s.lines.push({
      type:         "charge",
      chargeId:     c.id,
      label:        c.title,
      amount:       c.amountPaid,
      creditAmount: 0,
      status:       c.status,
      amountDue:    c.amount,
      amountPaid:   c.amountPaid,
    });
  }

  // Sort by paidAt descending
  const sessions = Array.from(sessionMap.values())
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  // ── Open bills (payments not fully paid) ──────────────────────────────────
  const openPayments = await prisma.payment.findMany({
    where:   { userId: user.id, status: { not: "PAID" } },
    include: { tenant: true, room: { include: { recurringCharges: true } } },
    orderBy: [{ status: "asc" }, { month: "asc" }],
  });

  const openCharges = await prisma.oneTimeCharge.findMany({
    where:   { userId: user.id, status: { not: "PAID" } },
    include: { tenant: true },
    orderBy: { date: "asc" },
  });

  const openBills: OpenBill[] = [
    ...openPayments.map(p => ({
      type:           "payment" as const,
      id:             p.id,
      tenantId:       p.tenantId,
      tenantName:     p.tenant.name,
      label:          `${p.room.name} · ${formatRentalPeriodServer(p.month, p.tenant.moveInDate ? new Date(p.tenant.moveInDate).getDate() : 1)}`,
      month:          p.month,
      amountDue:      p.amountDue,
      amountPaid:     p.amountPaid,
      status:         p.status,
      tenantPhone:    p.tenant.phone,
      whatsappNotify: p.tenant.whatsappNotify,
      breakdown: {
        baseRent: p.room.monthlyRent,
        charges:  p.room.recurringCharges
          .filter(c => (c.tenantId === null || c.tenantId === p.tenantId) && (!c.effectiveFrom || c.effectiveFrom <= p.month))
          .map(c => ({ title: c.title, amount: c.amount })),
      },
    })),
    ...openCharges.map(c => {
      // Map charge date → billing month, accounting for tenant's billing day.
      // e.g. billing day 29, charge dated May 1: day 1 < 29 → belongs to April period.
      const billingDay  = c.tenant.moveInDate ? new Date(c.tenant.moveInDate).getDate() : 1;
      const chargeDay   = c.date.getDate();
      let   payMonthNum = c.date.getMonth() + 1;
      let   payYear     = c.date.getFullYear();
      if (chargeDay < billingDay) {
        payMonthNum--;
        if (payMonthNum < 1) { payMonthNum = 12; payYear--; }
      }
      return {
        type:       "charge" as const,
        id:         c.id,
        tenantId:   c.tenantId,
        tenantName: c.tenant.name,
        label:      c.title,
        month:      `${payYear}-${String(payMonthNum).padStart(2, "0")}`,
        amountDue:  c.amount,
        amountPaid: c.amountPaid,
        status:     c.status,
      };
    }),
  ];

  // Sort: OVERDUE first, then PARTIAL, then PENDING
  const statusOrder: Record<string, number> = { OVERDUE: 0, PARTIAL: 1, PENDING: 2 };
  openBills.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">{sessions.length} payment record{sessions.length !== 1 ? "s" : ""}</p>
        </div>
        <GeneratePaymentsButton />
      </div>

      <PaymentsView
        sessions={sessions}
        openBills={openBills}
        currencySymbol={settings.currencySymbol}
        isPro={isPro(user)}
      />
    </div>
  );
}

// Server-side helper (can't import client util in server component that also does db calls)
function formatRentalPeriodServer(month: string, moveInDay: number): string {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, moveInDay);
  const end   = new Date(year, m, moveInDay);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.toLocaleDateString("en", { ...opts, year: "numeric" })} – ${end.toLocaleDateString("en", { ...opts, year: "numeric" })}`;
  }
  return `${start.toLocaleDateString("en", opts)} – ${end.toLocaleDateString("en", { ...opts, year: "numeric" })}`;
}
