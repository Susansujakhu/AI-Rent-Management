import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requireAuth } = await import("@/lib/auth");
  const user = await requireAuth();
  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id, userId: user.id },
    include: { room: { select: { monthlyRent: true } } },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allCharges = await prisma.recurringCharge.findMany({
    where: {
      roomId:  payment.roomId,
      userId:  user.id,
      OR: [{ tenantId: null }, { tenantId: payment.tenantId }],
    },
    select: { title: true, amount: true, effectiveFrom: true, effectiveTo: true },
    orderBy: { createdAt: "asc" },
  });

  const charges = allCharges
    .filter(c => (!c.effectiveFrom || c.effectiveFrom <= payment.month)
              && (!c.effectiveTo   || payment.month <= c.effectiveTo))
    .map(c => ({ title: c.title, amount: c.amount }));

  return NextResponse.json({ baseRent: payment.room.monthlyRent, charges });
}
