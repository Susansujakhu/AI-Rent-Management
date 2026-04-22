import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { month } = body;

  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });
  }

  // Active tenants = has a room and hasn't moved out before this month
  const [year, m] = month.split("-").map(Number);
  const monthStart = new Date(year, m - 1, 1);

  const tenants = await prisma.tenant.findMany({
    where: {
      userId,
      roomId: { not: null },
      OR: [
        { moveOutDate: null },
        { moveOutDate: { gte: monthStart } },
      ],
    },
    include: {
      room: {
        include: { recurringCharges: true },
      },
    },
  });

  // Find which tenants already have a payment for this month
  const existing = await prisma.payment.findMany({
    where: { userId, month },
    select: { tenantId: true },
  });
  const existingSet = new Set(existing.map(p => p.tenantId));

  let created = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    if (!tenant.roomId || !tenant.room) continue;

    if (existingSet.has(tenant.id)) {
      skipped++;
      continue;
    }

    // amountDue = room rent + active recurring charges for this room/tenant
    const recurringTotal = (tenant.room.recurringCharges ?? [])
      .filter(c => {
        if (c.tenantId && c.tenantId !== tenant.id) return false;
        if (!c.effectiveFrom) return true;
        return c.effectiveFrom <= month;
      })
      .reduce((sum, c) => sum + c.amount, 0);

    await prisma.payment.create({
      data: {
        userId,
        tenantId:  tenant.id,
        roomId:    tenant.roomId,
        month,
        amountDue: tenant.room.monthlyRent + recurringTotal,
        status:    "PENDING",
      },
    });
    created++;
  }

  return NextResponse.json({ ok: true, created, skipped, month });
}
