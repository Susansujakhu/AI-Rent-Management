import { prisma } from "./prisma";

export async function generatePaymentsFromMoveIn(
  userId:     string,
  tenantId:   string,
  roomId:     string,
  moveInDate: Date,
): Promise<number> {
  const room = await prisma.room.findUnique({
    where:   { id: roomId, userId },
    include: { recurringCharges: true },
  });
  if (!room) return 0;

  const now         = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Build list of months from moveIn to now
  let year  = moveInDate.getFullYear();
  let month = moveInDate.getMonth() + 1;
  const months: string[] = [];
  while (true) {
    const m = `${year}-${String(month).padStart(2, "0")}`;
    months.push(m);
    if (m >= currentMonth) break;
    month++;
    if (month > 12) { month = 1; year++; }
  }

  // Find already-existing payments for this tenant
  const existing = await prisma.payment.findMany({
    where:  { tenantId, month: { in: months } },
    select: { month: true },
  });
  const existingSet = new Set(existing.map(p => p.month));

  let created = 0;
  for (const m of months) {
    if (existingSet.has(m)) continue;

    const recurringTotal = room.recurringCharges
      .filter(c => {
        if (c.tenantId && c.tenantId !== tenantId) return false;
        return !c.effectiveFrom || c.effectiveFrom <= m;
      })
      .reduce((sum, c) => sum + c.amount, 0);

    await prisma.payment.create({
      data: {
        userId,
        tenantId,
        roomId,
        month:     m,
        amountDue: room.monthlyRent + recurringTotal,
        status:    m < currentMonth ? "OVERDUE" : "PENDING",
      },
    });
    created++;
  }

  return created;
}
