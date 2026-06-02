import type { PrismaClient } from "@prisma/client";
import { pickRentForMonth } from "./rent-history";

const round2 = (n: number) => parseFloat(n.toFixed(2));

// Status rule for a one-time charge — mirrors app/api/one-time-charges/[id].
const chargeStatusFor = (amount: number, amountPaid: number) =>
  amountPaid >= amount ? "PAID" : amountPaid > 0 ? "PARTIAL" : "PENDING";

export interface RecomputeResult {
  // Payment rows: amountDue + status from rent + recurring charges.
  scanned: number;   // payments scanned   (kept at top level for back-compat)
  changed: number;   // payments changed
  // One-time electricity charges re-derived from their meter readings.
  electricityRederived: number;
  // One-time charges whose status was re-synced to match amount vs amountPaid.
  chargeStatusFixed: number;
}

/**
 * Heals derived data after charge / rent / reading edits the regular hooks
 * missed. Used by the admin "Re-run all calculations" button. The money a
 * tenant has actually paid (amountPaid) is NEVER changed by any pass — only
 * what they owe (amountDue / a charge amount) and the resulting status.
 *
 *   1. PAYMENTS — recompute amountDue (base rent via rent-history + active
 *      recurring charges) and status on EVERY bill, paid ones included. A
 *      back-dated charge therefore raises a settled bill's due and flips it
 *      PAID -> PARTIAL (amountPaid stays put, only the balance grows). A bill
 *      whose due is unchanged is left exactly as-is, so correct PAID receipts
 *      never move.
 *
 *   2. ELECTRICITY — for every meter reading with a linked one-time charge,
 *      re-derive units = current − previous and amount = units × ratePerUnit
 *      (using the reading's own stored rate, so historical rates aren't
 *      rewritten). Heals the reading's stored snapshot always; updates the
 *      linked charge's amount + status only when the charge is NOT yet PAID.
 *
 *   3. CHARGE STATUS — re-sync every one-time charge's status to match its
 *      amount vs amountPaid. This only relabels; it never moves money, so it
 *      runs on all charges (a charge already updated in pass 2 is skipped).
 *
 * Note: a manually-typed one-time charge amount (e.g. "Total Internet
 * Remainings") is NOT derived from anything, so no pass can recompute it —
 * it can only be corrected by editing the charge directly.
 */
export async function recomputeBills(
  prisma: PrismaClient,
  scope: { userId?: string; roomId?: string; tenantId?: string } = {},
): Promise<RecomputeResult> {
  const today        = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // ── Pass 1: payments ──────────────────────────────────────────────────────
  // All bills, paid included — a back-dated charge must be able to raise a
  // settled bill's due. amountPaid is never written below, so paid money is
  // preserved; only amountDue + status change, and only when due actually moved.
  const payments = await prisma.payment.findMany({
    where: {
      ...(scope.userId   ? { userId:   scope.userId   } : {}),
      ...(scope.roomId   ? { roomId:   scope.roomId   } : {}),
      ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    },
    select: {
      id: true, month: true, amountDue: true, amountPaid: true, status: true,
      tenantId: true, roomId: true,
    },
  });

  // Bulk-load every room referenced so we don't re-query in the loop.
  const roomIds = Array.from(new Set(payments.map(p => p.roomId)));
  const rooms = await prisma.room.findMany({
    where:   { id: { in: roomIds } },
    include: { recurringCharges: true, rentHistory: true },
  });
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  let changed = 0;
  for (const p of payments) {
    const room = roomMap.get(p.roomId);
    if (!room) continue;

    const baseRent = pickRentForMonth(room.rentHistory, p.month, room.monthlyRent);
    const charges  = room.recurringCharges
      .filter(c => (c.tenantId === null || c.tenantId === p.tenantId)
        && (!c.effectiveFrom || c.effectiveFrom <= p.month)
        && (!c.effectiveTo   || p.month <= c.effectiveTo))
      .reduce((s, c) => s + c.amount, 0);

    const newDue     = baseRent + charges;
    const wasOverdue = p.status === "OVERDUE" || p.month < currentMonth;
    const newStatus  = newDue > 0 && p.amountPaid >= newDue ? "PAID"
      : p.amountPaid > 0                                     ? "PARTIAL"
      : wasOverdue                                           ? "OVERDUE" : "PENDING";

    if (newDue !== p.amountDue || newStatus !== p.status) {
      await prisma.payment.update({
        where: { id: p.id },
        data:  { amountDue: newDue, status: newStatus },
      });
      changed++;
    }
  }

  // Filter for one-time charges + meter readings (which carry userId/tenantId
  // but no roomId — resolve a roomId scope through the tenant relation).
  const ownerWhere = {
    ...(scope.userId   ? { userId:   scope.userId   } : {}),
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    ...(scope.roomId && !scope.tenantId ? { tenant: { roomId: scope.roomId } } : {}),
  };

  // ── Pass 2: electricity charges from meter readings ───────────────────────
  const handledCharges = new Set<string>();   // charges already settled by pass 2
  let electricityRederived = 0;

  const readings = await prisma.meterReading.findMany({
    where:  { ...ownerWhere, chargeId: { not: null } },
    select: { id: true, previous: true, current: true, ratePerUnit: true, unitsUsed: true, amount: true, chargeId: true },
  });

  const linkedChargeIds = readings.map(r => r.chargeId!).filter(Boolean);
  const linkedCharges = linkedChargeIds.length
    ? await prisma.oneTimeCharge.findMany({
        where:  { id: { in: linkedChargeIds } },
        select: { id: true, amount: true, amountPaid: true, status: true },
      })
    : [];
  const chargeMap = new Map(linkedCharges.map(c => [c.id, c]));

  for (const r of readings) {
    const units  = round2(r.current - r.previous);
    const amount = round2(units * r.ratePerUnit);

    // Heal the reading's own stored snapshot if it drifted.
    if (r.unitsUsed !== units || r.amount !== amount) {
      await prisma.meterReading.update({ where: { id: r.id }, data: { unitsUsed: units, amount } });
    }

    const charge = chargeMap.get(r.chargeId!);
    if (!charge) continue;
    handledCharges.add(charge.id);

    // Settled electricity is sacred — don't reopen a PAID charge.
    if (charge.status === "PAID") continue;

    const newStatus = chargeStatusFor(amount, charge.amountPaid);
    if (charge.amount !== amount || charge.status !== newStatus) {
      await prisma.oneTimeCharge.update({
        where: { id: charge.id },
        data:  { amount, status: newStatus },
      });
      electricityRederived++;
    }
  }

  // ── Pass 3: re-sync remaining one-time charge statuses ────────────────────
  // Pure relabel from amount vs amountPaid — never touches money, so it is
  // safe to run on every charge (PAID included).
  let chargeStatusFixed = 0;
  const charges = await prisma.oneTimeCharge.findMany({
    where:  ownerWhere,
    select: { id: true, amount: true, amountPaid: true, status: true },
  });
  for (const c of charges) {
    if (handledCharges.has(c.id)) continue;   // already settled in pass 2
    const newStatus = chargeStatusFor(c.amount, c.amountPaid);
    if (newStatus !== c.status) {
      await prisma.oneTimeCharge.update({ where: { id: c.id }, data: { status: newStatus } });
      chargeStatusFixed++;
    }
  }

  return { scanned: payments.length, changed, electricityRederived, chargeStatusFixed };
}
