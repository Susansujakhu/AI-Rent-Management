import type { PrismaClient } from "@prisma/client";

/**
 * Returns the rent amount in effect for a given bill `month` ("YYYY-MM") on a
 * given room. Picks the RentHistory row with the latest `effectiveFrom` that
 * is still <= `month`. Falls back to room.monthlyRent if no history exists.
 *
 * Pass in `prisma` so this works both in API routes and server components.
 */
export async function getRentForMonth(
  prisma: PrismaClient,
  roomId: string,
  month: string,
): Promise<number> {
  const row = await prisma.rentHistory.findFirst({
    where:   { roomId, effectiveFrom: { lte: month } },
    orderBy: { effectiveFrom: "desc" },
    select:  { amount: true },
  });
  if (row) return row.amount;

  // Fallback: should only happen for rooms that were never backfilled.
  const room = await prisma.room.findUnique({
    where: { id: roomId }, select: { monthlyRent: true },
  });
  return room?.monthlyRent ?? 0;
}

/**
 * Given a list of RentHistory rows (already loaded), pick the amount in
 * effect for `month`. Useful when you've fetched history once and want to
 * resolve many months without re-querying.
 */
export function pickRentForMonth(
  history: Array<{ effectiveFrom: string; amount: number }>,
  month: string,
  fallback: number,
): number {
  let best: { effectiveFrom: string; amount: number } | null = null;
  for (const h of history) {
    if (h.effectiveFrom <= month && (!best || h.effectiveFrom > best.effectiveFrom)) {
      best = h;
    }
  }
  return best?.amount ?? fallback;
}
