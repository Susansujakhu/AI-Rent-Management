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

  const now        = new Date();
  const todayDay   = now.getDate();
  const moveInDay  = moveInDate.getDate();

  // Last month to generate: current calendar month only if billing date has arrived
  // e.g. move-in day 23, today is Apr 22 → don't include April yet (Apr 23 hasn't come)
  //      move-in day 23, today is Apr 23 → include April
  let lastYear  = now.getFullYear();
  let lastMonth = now.getMonth() + 1;
  if (todayDay < moveInDay) {
    // Billing date hasn't arrived this month — go back one month
    lastMonth--;
    if (lastMonth < 1) { lastMonth = 12; lastYear--; }
  }
  const lastMonthStr = `${lastYear}-${String(lastMonth).padStart(2, "0")}`;

  // Build list of months from moveIn up to lastMonthStr
  let year  = moveInDate.getFullYear();
  let month = moveInDate.getMonth() + 1;
  const months: string[] = [];
  while (true) {
    const m = `${year}-${String(month).padStart(2, "0")}`;
    if (m > lastMonthStr) break;
    months.push(m);
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
        if (c.effectiveFrom && c.effectiveFrom > m) return false;
        if (c.effectiveTo   && c.effectiveTo   < m) return false;
        return true;
      })
      .reduce((sum, c) => sum + c.amount, 0);

    await prisma.payment.create({
      data: {
        userId,
        tenantId,
        roomId,
        month:     m,
        amountDue: room.monthlyRent + recurringTotal,
        status:    m < lastMonthStr ? "OVERDUE" : "PENDING",
      },
    });
    created++;
  }

  return created;
}
