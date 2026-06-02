import type { PrismaClient } from "@prisma/client";
import { pickRentForMonth } from "./rent-history";

/**
 * Recomputes amountDue + status on every non-PAID Payment for the given
 * scope. Used by the admin "Re-run all calculations" button to heal data
 * after schema/charge edits the regular hooks missed.
 *
 *   - PAID bills are deliberately skipped (money received in full, receipt
 *     out — that history is sacred).
 *   - PARTIAL bills DO update; their amountPaid stays, status reclassifies.
 *
 * Returns the count of rows actually changed.
 */
export async function recomputeBills(
  prisma: PrismaClient,
  scope: { userId?: string; roomId?: string; tenantId?: string } = {},
): Promise<{ scanned: number; changed: number }> {
  const today        = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // Pull every non-PAID payment in scope along with the room context needed
  // to recompute the amount.
  const payments = await prisma.payment.findMany({
    where: {
      ...(scope.userId   ? { userId:   scope.userId   } : {}),
      ...(scope.roomId   ? { roomId:   scope.roomId   } : {}),
      ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
      status: { not: "PAID" },
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

  return { scanned: payments.length, changed };
}
