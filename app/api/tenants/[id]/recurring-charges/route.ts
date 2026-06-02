import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { pickRentForMonth } from "@/lib/rent-history";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id: tenantId } = await params;
  const { title, amount, effectiveFrom } = await req.json();

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (effectiveFrom && !/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveFrom)) {
    return NextResponse.json({ error: "effectiveFrom must be in YYYY-MM format" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId, userId }, select: { roomId: true } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!tenant.roomId) {
    return NextResponse.json({ error: "Tenant has no room assigned" }, { status: 400 });
  }

  const charge = await prisma.recurringCharge.create({
    data: {
      userId,
      roomId: tenant.roomId,
      tenantId,
      title: title.trim(),
      amount: parsedAmount,
      effectiveFrom: effectiveFrom || null,
    },
  });

  // Recompute amountDue on the tenant's unpaid bills (amountPaid = 0) whose
  // month falls inside this charge's effective window. PAID and PARTIAL
  // bills are never touched — history is sacred.
  const room = await prisma.room.findUnique({
    where:   { id: tenant.roomId },
    include: { recurringCharges: true, rentHistory: true },
  });
  if (room) {
    const unpaid = await prisma.payment.findMany({
      where: {
        userId,
        tenantId,
        amountPaid: 0,
        ...(effectiveFrom ? { month: { gte: effectiveFrom } } : {}),
      },
      select: { id: true, month: true },
    });
    for (const p of unpaid) {
      const baseRent = pickRentForMonth(room.rentHistory, p.month, room.monthlyRent);
      const chargesForMonth = room.recurringCharges
        .filter(c => (c.tenantId === null || c.tenantId === tenantId)
          && (!c.effectiveFrom || c.effectiveFrom <= p.month)
          && (!c.effectiveTo   || p.month <= c.effectiveTo))
        .reduce((s, c) => s + c.amount, 0);
      await prisma.payment.update({
        where: { id: p.id },
        data:  { amountDue: baseRent + chargesForMonth },
      });
    }
  }

  return NextResponse.json(charge);
}
