import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { pickRentForMonth } from "@/lib/rent-history";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
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
  // Verify the room belongs to this user before creating a charge for it
  const room = await prisma.room.findUnique({
    where:   { id, userId },
    include: { recurringCharges: true, rentHistory: true },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const charge = await prisma.recurringCharge.create({
    data: {
      userId,
      roomId: id,
      title: title.trim(),
      amount: parsedAmount,
      effectiveFrom: effectiveFrom || null,
    },
  });

  // Recompute unpaid bills (amountPaid = 0) across all tenants in this room
  // whose month falls within the new charge's effective window. Room-level
  // charges apply to every tenant (tenantId IS NULL on the charge), so the
  // recompute spans the room's full payment list.
  const unpaid = await prisma.payment.findMany({
    where: {
      userId,
      roomId: id,
      status: { not: "PAID" },               // PAID bills stay locked
      ...(effectiveFrom ? { month: { gte: effectiveFrom } } : {}),
    },
    select: { id: true, month: true, tenantId: true, amountPaid: true, status: true },
  });
  // Re-fetch room with the new charge included.
  const fresh = await prisma.room.findUnique({
    where:   { id, userId },
    include: { recurringCharges: true, rentHistory: true },
  });
  if (fresh) {
    const today        = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    for (const p of unpaid) {
      const baseRent = pickRentForMonth(fresh.rentHistory, p.month, fresh.monthlyRent);
      const chargesForMonth = fresh.recurringCharges
        .filter(c => (c.tenantId === null || c.tenantId === p.tenantId)
          && (!c.effectiveFrom || c.effectiveFrom <= p.month)
          && (!c.effectiveTo   || p.month <= c.effectiveTo))
        .reduce((s, c) => s + c.amount, 0);
      const newDue = baseRent + chargesForMonth;
      const wasOverdue = p.status === "OVERDUE" || p.month < currentMonth;
      const newStatus = newDue > 0 && p.amountPaid >= newDue ? "PAID"
        : p.amountPaid > 0                                    ? "PARTIAL"
        : wasOverdue                                          ? "OVERDUE" : "PENDING";
      await prisma.payment.update({
        where: { id: p.id },
        data:  { amountDue: newDue, status: newStatus },
      });
    }
  }

  return NextResponse.json(charge);
}
