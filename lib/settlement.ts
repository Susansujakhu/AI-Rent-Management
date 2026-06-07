import { prisma } from "./prisma";
import { getRentForMonth } from "./rent-history";
import { resolveStatus, periodForDate, prorate, recurringTotalFor, settleTotals } from "./settlement-math";

// ── Move-out settlement engine ───────────────────────────────────────────────
// Billing periods are anchored to the tenant's move-in day: payment "2026-06"
// covers Jun {moveInDay} → day before Jul {moveInDay}. The final period is
// pro-rated by days actually occupied within that period (the old move-out
// code pro-rated by calendar-month day, which drifts for mid-month move-ins).

export type SettlementDeduction = { title: string; amount: number };

export type SettlementLine = {
  type: "rent" | "charge" | "deduction";
  id: string | null;        // payment/charge id (null for not-yet-created deductions)
  label: string;            // "Rent — Jun 2026" / charge title
  month?: string;           // rent lines only
  due: number;
  paid: number;
  outstanding: number;
};

export type SettlementPreview = {
  tenantId: string;
  moveOutDate: string;          // ISO date
  finalMonth: {
    month: string;
    baseAmount: number;         // full period rent + recurring charges
    proratedDue: number;
    daysOccupied: number;
    daysInPeriod: number;
    adjusted: boolean;          // false if the payment was already paid and left as-is
  } | null;
  lines: SettlementLine[];      // outstanding items (after proration)
  deletedFutureMonths: string[];
  totalDue: number;
  creditBalance: number;
  depositHeld: number;
  creditApplied: number;
  depositApplied: number;
  balanceDue: number;
  refundDue: number;
};

/**
 * Compute the settlement preview — pure read, nothing is written.
 * `deductions` lets the wizard recompute totals as the owner adds items.
 */
export async function previewSettlement(
  userId: string,
  tenantId: string,
  moveOutDate: Date,
  deductions: SettlementDeduction[] = [],
): Promise<SettlementPreview | { error: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId, userId },
    include: {
      room: { include: { recurringCharges: true } },
      payments: { orderBy: { month: "asc" } },
      oneTimeCharges: { orderBy: { date: "asc" } },
    },
  });
  if (!tenant) return { error: "Tenant not found" };
  if (tenant.moveOutDate) return { error: "Tenant has already moved out" };
  if (moveOutDate < tenant.moveInDate) return { error: "Move-out date cannot be before move-in date" };

  const moveInDay = tenant.moveInDate.getDate();

  // ── Final period proration ────────────────────────────────────────────────
  let finalMonth: SettlementPreview["finalMonth"] = null;
  let finalMonthStr: string | null = null;

  if (tenant.room && tenant.roomId) {
    finalMonthStr = periodForDate(moveOutDate, moveInDay);
    const rent = await getRentForMonth(prisma, tenant.roomId, finalMonthStr);
    const baseAmount = rent + recurringTotalFor(tenant.room.recurringCharges, tenantId, finalMonthStr);

    const { daysInPeriod, daysOccupied, proratedDue } = prorate(finalMonthStr, moveInDay, moveOutDate, baseAmount);

    const finalPayment = tenant.payments.find(p => p.month === finalMonthStr);
    // Never reduce below what was already paid (mirrors old behavior of
    // leaving paid months untouched, but handles partial payments too).
    const adjusted = !finalPayment || finalPayment.amountPaid < proratedDue || finalPayment.amountPaid === 0;
    finalMonth = {
      month: finalMonthStr,
      baseAmount,
      proratedDue: finalPayment ? Math.max(proratedDue, finalPayment.amountPaid) : proratedDue,
      daysOccupied,
      daysInPeriod,
      adjusted,
    };
  }

  // ── Outstanding lines (with proration + future deletion simulated) ────────
  const lines: SettlementLine[] = [];
  const deletedFutureMonths: string[] = [];

  for (const p of tenant.payments) {
    if (finalMonthStr && p.month > finalMonthStr) {
      if (p.status === "PENDING" && p.amountPaid === 0) {
        deletedFutureMonths.push(p.month);
        continue;            // will be deleted — not part of dues
      }
      // paid/partial future month: keep as a normal line
    }
    const due = finalMonth && p.month === finalMonthStr ? finalMonth.proratedDue : p.amountDue;
    const outstanding = Math.max(0, due - p.amountPaid);
    if (outstanding <= 0) continue;
    lines.push({
      type: "rent",
      id: p.id,
      label: `Rent — ${p.month}`,
      month: p.month,
      due,
      paid: p.amountPaid,
      outstanding,
    });
  }

  for (const c of tenant.oneTimeCharges) {
    const outstanding = Math.max(0, c.amount - c.amountPaid);
    if (outstanding <= 0) continue;
    lines.push({
      type: "charge",
      id: c.id,
      label: c.title,
      due: c.amount,
      paid: c.amountPaid,
      outstanding,
    });
  }

  for (const d of deductions) {
    const amount = Number(d.amount) || 0;
    if (amount <= 0) continue;
    lines.push({
      type: "deduction",
      id: null,
      label: d.title || "Deduction",
      due: amount,
      paid: 0,
      outstanding: amount,
    });
  }

  // ── Settle against credit, then deposit ───────────────────────────────────
  const totalDue = lines.reduce((s, l) => s + l.outstanding, 0);
  const { creditApplied, depositApplied, balanceDue, refundDue } = settleTotals(totalDue, tenant.creditBalance, tenant.deposit);

  return {
    tenantId,
    moveOutDate: moveOutDate.toISOString(),
    finalMonth,
    lines,
    deletedFutureMonths,
    totalDue,
    creditBalance: tenant.creditBalance,
    depositHeld: tenant.deposit,
    creditApplied,
    depositApplied,
    balanceDue,
    refundDue,
  };
}

// Reversal ledger entry — everything needed to void the settlement.
type AppliedEntry = {
  type: "payment" | "charge";
  id: string;
  amount: number;                       // total applied (credit + deposit)
  txnIds: string[];                     // PaymentTransaction / ChargeTransaction ids created
  prev: {
    amountDue?: number;                 // payments only (proration restore)
    amountPaid: number;
    status: string;
    method?: string | null;
    paidDate?: string | null;
    notes?: string | null;
  };
};

/**
 * Execute the settlement atomically. Returns the created Settlement or an error.
 */
export async function executeSettlement(
  userId: string,
  tenantId: string,
  opts: { moveOutDate: Date; deductions: SettlementDeduction[]; notes?: string },
) {
  const preview = await previewSettlement(userId, tenantId, opts.moveOutDate, opts.deductions);
  if ("error" in preview) return preview;

  const existing = await prisma.settlement.findUnique({ where: { tenantId } });
  if (existing) return { error: "A settlement already exists for this tenant" };

  const applied: AppliedEntry[] = [];
  const deductionChargeIds: string[] = [];
  const deletedFuture: Array<{ month: string; amountDue: number; status: string; roomId: string }> = [];

  const settlement = await prisma.$transaction(async tx => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId, userId } });

    // 1. Create one-time charges for deductions (so they appear in the ledger)
    for (const d of opts.deductions) {
      const amount = Number(d.amount) || 0;
      if (amount <= 0) continue;
      const charge = await tx.oneTimeCharge.create({
        data: {
          userId, tenantId,
          title: (d.title || "Deduction").trim(),
          amount,
          date: opts.moveOutDate,
          notes: "Added at move-out settlement",
        },
      });
      deductionChargeIds.push(charge.id);
    }

    // 2. Pro-rate the final period
    if (preview.finalMonth) {
      const p = await tx.payment.findUnique({
        where: { tenantId_month: { tenantId, month: preview.finalMonth.month } },
      });
      if (p && p.amountDue !== preview.finalMonth.proratedDue) {
        await tx.payment.update({
          where: { id: p.id },
          data: {
            amountDue: preview.finalMonth.proratedDue,
            status: resolveStatus(p.amountPaid, preview.finalMonth.proratedDue, p.status === "OVERDUE"),
          },
        });
      }
    }

    // 3. Delete future pre-generated months (remember them for void)
    if (preview.finalMonth) {
      const future = await tx.payment.findMany({
        where: { tenantId, userId, month: { gt: preview.finalMonth.month }, status: "PENDING", amountPaid: 0 },
      });
      for (const p of future) {
        deletedFuture.push({ month: p.month, amountDue: p.amountDue, status: p.status, roomId: p.roomId });
      }
      await tx.payment.deleteMany({
        where: { id: { in: future.map(p => p.id) } },
      });
    }

    // 4. Apply credit then deposit, oldest-first: rent payments, then charges.
    //    Each application creates a transaction row so the payments page,
    //    receipts and void all stay consistent.
    let creditLeft  = preview.creditApplied;
    let depositLeft = preview.depositApplied;
    let isFirstTxn  = true;
    const totalApplied = preview.creditApplied + preview.depositApplied;

    const takeFunds = (need: number): Array<{ source: "ADVANCE" | "DEPOSIT"; amount: number }> => {
      const parts: Array<{ source: "ADVANCE" | "DEPOSIT"; amount: number }> = [];
      const fromCredit = Math.min(creditLeft, need);
      if (fromCredit > 0) { parts.push({ source: "ADVANCE", amount: fromCredit }); creditLeft -= fromCredit; need -= fromCredit; }
      const fromDeposit = Math.min(depositLeft, need);
      if (fromDeposit > 0) { parts.push({ source: "DEPOSIT", amount: fromDeposit }); depositLeft -= fromDeposit; }
      return parts;
    };

    // Rent payments oldest-first
    const unpaidPayments = await tx.payment.findMany({
      where: { tenantId, userId, status: { not: "PAID" } },
      orderBy: { month: "asc" },
    });
    for (const p of unpaidPayments) {
      if (creditLeft + depositLeft <= 0) break;
      const balance = p.amountDue - p.amountPaid;
      if (balance <= 0) continue;
      const parts = takeFunds(balance);
      const applyTotal = parts.reduce((s, x) => s + x.amount, 0);
      if (applyTotal <= 0) continue;

      const prev = { amountDue: p.amountDue, amountPaid: p.amountPaid, status: p.status, method: p.method, paidDate: p.paidDate?.toISOString() ?? null, notes: p.notes };
      const newPaid = p.amountPaid + applyTotal;
      const method  = parts.length === 1 ? parts[0].source : "DEPOSIT";
      await tx.payment.update({
        where: { id: p.id },
        data: {
          amountPaid: newPaid,
          status:     resolveStatus(newPaid, p.amountDue, p.status === "OVERDUE"),
          method,
          paidDate:   opts.moveOutDate,
          notes:      "Settled at move-out",
        },
      });
      const txnIds: string[] = [];
      for (const part of parts) {
        const txn = await tx.paymentTransaction.create({
          data: {
            userId, paymentId: p.id,
            amount: part.amount,
            totalEntered: isFirstTxn ? totalApplied : 0,
            method: part.source,
            paidAt: opts.moveOutDate,
            note: "Move-out settlement",
          },
        });
        txnIds.push(txn.id);
        isFirstTxn = false;
      }
      applied.push({ type: "payment", id: p.id, amount: applyTotal, txnIds, prev });
    }

    // One-time charges oldest-first (includes deduction charges just created)
    const unpaidCharges = await tx.oneTimeCharge.findMany({
      where: { tenantId, userId, status: { not: "PAID" } },
      orderBy: { date: "asc" },
    });
    for (const c of unpaidCharges) {
      if (creditLeft + depositLeft <= 0) break;
      const balance = c.amount - c.amountPaid;
      if (balance <= 0) continue;
      const parts = takeFunds(balance);
      const applyTotal = parts.reduce((s, x) => s + x.amount, 0);
      if (applyTotal <= 0) continue;

      const prev = { amountPaid: c.amountPaid, status: c.status, notes: c.notes };
      const newPaid = c.amountPaid + applyTotal;
      await tx.oneTimeCharge.update({
        where: { id: c.id },
        data: { amountPaid: newPaid, status: newPaid >= c.amount ? "PAID" : "PARTIAL" },
      });
      const txnIds: string[] = [];
      for (const part of parts) {
        const txn = await tx.chargeTransaction.create({
          data: {
            userId, tenantId, chargeId: c.id,
            chargeTitle: c.title,
            amount: part.amount,
            method: part.source,
            paidAt: opts.moveOutDate,
            note: "Move-out settlement",
          },
        });
        txnIds.push(txn.id);
        isFirstTxn = false;
      }
      applied.push({ type: "charge", id: c.id, amount: applyTotal, txnIds, prev });
    }

    // 5. Mark tenant moved out; consume applied credit
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        moveOutDate: opts.moveOutDate,
        creditBalance: tenant.creditBalance - preview.creditApplied,
      },
    });

    // 6. Record the settlement
    return tx.settlement.create({
      data: {
        userId, tenantId,
        moveOutDate: opts.moveOutDate,
        totalDue: preview.totalDue,
        creditApplied: preview.creditApplied,
        depositHeld: preview.depositHeld,
        depositApplied: preview.depositApplied,
        refundDue: preview.refundDue,
        balanceDue: preview.balanceDue,
        notes: opts.notes?.trim() || null,
        detail: JSON.stringify({
          finalMonth: preview.finalMonth,
          lines: preview.lines,
          deductions: opts.deductions.filter(d => (Number(d.amount) || 0) > 0),
          deductionChargeIds,
          applied,
          deletedFuture,
        }),
      },
    });
  });

  return { settlement };
}

/**
 * Void a settlement: restore payments/charges, recreate deleted future months,
 * delete deduction charges, restore credit, clear move-out date.
 */
export async function voidSettlement(userId: string, tenantId: string) {
  const settlement = await prisma.settlement.findUnique({ where: { tenantId } });
  if (!settlement || settlement.userId !== userId) return { error: "No settlement found" };

  const detail = settlement.detail ? JSON.parse(settlement.detail) : {};
  const applied: AppliedEntry[] = detail.applied ?? [];
  const deductionChargeIds: string[] = detail.deductionChargeIds ?? [];
  const deletedFuture: Array<{ month: string; amountDue: number; status: string; roomId: string }> = detail.deletedFuture ?? [];
  const finalMonth = detail.finalMonth as { month: string; baseAmount: number } | null;

  await prisma.$transaction(async tx => {
    // Defense-in-depth: restore only the credit whose ADVANCE transactions
    // still exist (if some other void already returned part of it, don't
    // double-restore). Computed BEFORE the deletions below.
    const payTxnIds = applied.filter(a => a.type === "payment").flatMap(a => a.txnIds);
    const chgTxnIds = applied.filter(a => a.type === "charge").flatMap(a => a.txnIds);
    const payAdv = await tx.paymentTransaction.aggregate({
      where: { id: { in: payTxnIds }, method: "ADVANCE" }, _sum: { amount: true },
    });
    const chgAdv = await tx.chargeTransaction.aggregate({
      where: { id: { in: chgTxnIds }, method: "ADVANCE" }, _sum: { amount: true },
    });
    const creditToRestore = Math.min(
      settlement.creditApplied,
      (payAdv._sum.amount ?? 0) + (chgAdv._sum.amount ?? 0),
    );

    // Reverse applications (skip deduction charges — they get deleted below).
    // updateMany tolerates rows deleted since settlement without aborting the tx.
    for (const a of applied) {
      if (a.type === "payment") {
        await tx.payment.updateMany({
          where: { id: a.id, userId },
          data: {
            amountPaid: a.prev.amountPaid,
            status:     a.prev.status,
            method:     a.prev.method ?? null,
            paidDate:   a.prev.paidDate ? new Date(a.prev.paidDate) : null,
            notes:      a.prev.notes ?? null,
          },
        });
        await tx.paymentTransaction.deleteMany({ where: { id: { in: a.txnIds } } });
      } else if (!deductionChargeIds.includes(a.id)) {
        await tx.oneTimeCharge.updateMany({
          where: { id: a.id, userId },
          data: { amountPaid: a.prev.amountPaid, status: a.prev.status },
        });
        await tx.chargeTransaction.deleteMany({ where: { id: { in: a.txnIds } } });
      }
    }

    // Delete deduction charges created by the settlement (cascades transactions)
    if (deductionChargeIds.length > 0) {
      await tx.oneTimeCharge.deleteMany({ where: { id: { in: deductionChargeIds }, userId } });
    }

    // Restore the final month's full amount
    if (finalMonth) {
      const p = await tx.payment.findUnique({
        where: { tenantId_month: { tenantId, month: finalMonth.month } },
      });
      if (p) {
        await tx.payment.update({
          where: { id: p.id },
          data: {
            amountDue: finalMonth.baseAmount,
            status: resolveStatus(p.amountPaid, finalMonth.baseAmount, p.status === "OVERDUE"),
          },
        });
      }
    }

    // Recreate deleted future months (skip any that already exist again)
    for (const f of deletedFuture) {
      const exists = await tx.payment.findUnique({
        where: { tenantId_month: { tenantId, month: f.month } },
        select: { id: true },
      });
      if (!exists) {
        await tx.payment.create({
          data: { userId, tenantId, roomId: f.roomId, month: f.month, amountDue: f.amountDue, status: f.status },
        });
      }
    }

    // Restore credit, clear move-out
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        moveOutDate: null,
        creditBalance: { increment: creditToRestore },
      },
    });

    await tx.settlement.delete({ where: { id: settlement.id } });
  });

  return { success: true };
}
