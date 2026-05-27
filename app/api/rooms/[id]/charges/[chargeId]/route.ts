import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

// Stop a recurring charge from a given month onward (instead of deleting it),
// so past/billed months keep it and only future months drop it.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id: roomId, chargeId } = await params;
  const body = await req.json();

  let effectiveTo: string | null;
  if (body.effectiveTo === null || body.effectiveTo === "") {
    effectiveTo = null; // resume — clears the end month
  } else if (typeof body.effectiveTo === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.effectiveTo)) {
    effectiveTo = body.effectiveTo;
  } else {
    return NextResponse.json({ error: "effectiveTo must be in YYYY-MM format" }, { status: 400 });
  }

  const updated = await prisma.recurringCharge.updateMany({
    where: { id: chargeId, userId, roomId },
    data:  { effectiveTo },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Re-bill the future: months after the stop month that are still fully unpaid
  // get their amountDue recomputed so the stopped charge drops off. Past and
  // paid/partially-paid months are left untouched.
  if (effectiveTo) {
    const charge = await prisma.recurringCharge.findUnique({ where: { id: chargeId }, select: { tenantId: true } });
    const room   = await prisma.room.findUnique({ where: { id: roomId, userId }, include: { recurringCharges: true } });
    if (room) {
      const payments = await prisma.payment.findMany({
        where: {
          userId, roomId,
          amountPaid: 0,
          status: { not: "PAID" },
          month: { gt: effectiveTo },
          ...(charge?.tenantId ? { tenantId: charge.tenantId } : {}),
        },
        select: { id: true, tenantId: true, month: true, amountDue: true },
      });
      for (const p of payments) {
        const total = room.recurringCharges
          .filter(c => (c.tenantId === null || c.tenantId === p.tenantId)
            && (!c.effectiveFrom || c.effectiveFrom <= p.month)
            && (!c.effectiveTo   || p.month <= c.effectiveTo))
          .reduce((s, c) => s + c.amount, 0);
        const newDue = room.monthlyRent + total;
        if (newDue !== p.amountDue) {
          await prisma.payment.update({ where: { id: p.id }, data: { amountDue: newDue } });
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { chargeId } = await params;
  await prisma.recurringCharge.delete({ where: { id: chargeId, userId } });
  return NextResponse.json({ success: true });
}
