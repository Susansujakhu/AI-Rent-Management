/**
 * One-time backfill: insert one RentHistory row per existing room so the new
 * rent-lookup logic has a row to land on for any historical bill month.
 *
 * effectiveFrom = the earliest tenant's moveInDate (formatted YYYY-MM), or
 * the room's createdAt month if the room has never had a tenant.
 *
 * Idempotent: skips any room that already has at least one RentHistory row.
 *
 * Run: npx tsx scripts/backfill-rent-history.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  const rooms = await prisma.room.findMany({
    include: {
      tenants:    { orderBy: { moveInDate: "asc" }, take: 1, select: { moveInDate: true } },
      rentHistory: { take: 1, select: { id: true } },
    },
  });

  let inserted = 0;
  let skipped  = 0;

  for (const r of rooms) {
    if (r.rentHistory.length > 0) { skipped++; continue; }

    const seedDate = r.tenants[0]?.moveInDate ?? r.createdAt;
    const effectiveFrom = ymOf(seedDate);

    await prisma.rentHistory.create({
      data: {
        userId:        r.userId,
        roomId:        r.id,
        amount:        r.monthlyRent,
        effectiveFrom,
        reason:        "Initial rate (backfill)",
      },
    });
    inserted++;
    console.log(`✓ ${r.name} → ${r.monthlyRent} from ${effectiveFrom}`);
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
