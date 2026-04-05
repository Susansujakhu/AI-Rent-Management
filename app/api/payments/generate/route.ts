import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function monthString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Returns all months from startMonth to endMonth inclusive, as "YYYY-MM" strings
function monthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);
  let year = sy;
  let mon = sm;
  while (year < ey || (year === ey && mon <= em)) {
    months.push(monthString(year, mon));
    mon++;
    if (mon > 12) { mon = 1; year++; }
  }
  return months;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { month } = body; // target billing month e.g. "2026-04"

  if (!month) {
    return NextResponse.json({ error: "month is required" }, { status: 400 });
  }

  const activeTenants = await prisma.tenant.findMany({
    where: { moveOutDate: null, roomId: { not: null } },
    include: { room: { include: { recurringCharges: true } } },
  });

  const today = new Date();
  const currentMonth = monthString(today.getFullYear(), today.getMonth() + 1);
  // Never generate bills beyond current month
  const upToMonth = month > currentMonth ? currentMonth : month;

  // 12-month lookback window
  const lookbackDate = new Date();
  lookbackDate.setMonth(lookbackDate.getMonth() - 11);
  const lookbackMonth = monthString(lookbackDate.getFullYear(), lookbackDate.getMonth() + 1);

  let created = 0;
  for (const tenant of activeTenants) {
    if (!tenant.roomId || !tenant.room) continue;

    const moveInMonth = monthString(
      tenant.moveInDate.getFullYear(),
      tenant.moveInDate.getMonth() + 1
    );

    // Start from whichever is more recent: move-in or 12-month lookback
    const startMonth = moveInMonth > lookbackMonth ? moveInMonth : lookbackMonth;

    // Generate all missing months from startMonth up to the target month
    const months = monthRange(startMonth, upToMonth);

    for (const m of months) {
      const existing = await prisma.payment.findUnique({
        where: { tenantId_month: { tenantId: tenant.id, month: m } },
      });
      if (!existing) {
        const isPast = m < currentMonth;
        await prisma.payment.create({
          data: {
            tenantId: tenant.id,
            roomId: tenant.roomId,
            month: m,
            amountDue: tenant.room.monthlyRent + tenant.room.recurringCharges.reduce((s, c) => s + c.amount, 0),
            amountPaid: 0,
            status: isPast ? "OVERDUE" : "PENDING",
          },
        });
        created++;
      }
    }
  }

  return NextResponse.json({ created });
}
