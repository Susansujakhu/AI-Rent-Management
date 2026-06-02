import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { pickRentForMonth } from "@/lib/rent-history";

function resolveStatus(paid: number, due: number, wasOverdue: boolean): string {
  if (due === 0)        return paid > 0 ? "PAID" : (wasOverdue ? "OVERDUE" : "PENDING");
  if (paid >= due)      return "PAID";
  if (paid > 0)         return "PARTIAL";
  return wasOverdue ? "OVERDUE" : "PENDING";
}

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

// DELETE is destructive on purpose: removes the charge AND recomputes every
// bill that ever used it — including PAID and PARTIAL months — so balances
// and statuses reflect the room as if the charge never existed. The UI
// surfaces this with a clear warning before the call is made.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id: roomId, chargeId } = await params;

  // Load the charge so we know its scope (tenant-specific vs room-level)
  // before deletion.
  const charge = await prisma.recurringCharge.findFirst({
    where:  { id: chargeId, userId, roomId },
    select: { tenantId: true },
  });
  if (!charge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.recurringCharge.delete({ where: { id: chargeId, userId } });

  // Re-fetch the room with the charge gone so the recompute uses the post-
  // delete charge set.
  const room = await prisma.room.findUnique({
    where:   { id: roomId, userId },
    include: { recurringCharges: true, rentHistory: true },
  });
  if (!room) return NextResponse.json({ success: true, recomputed: 0 });

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // Scope: tenant-specific charge → only that tenant's bills. Room-level
  // charge → every payment for the room.
  const payments = await prisma.payment.findMany({
    where: {
      userId, roomId,
      ...(charge.tenantId ? { tenantId: charge.tenantId } : {}),
    },
    select: { id: true, tenantId: true, month: true, amountDue: true, amountPaid: true, status: true },
  });

  let recomputed = 0;
  for (const p of payments) {
    const baseRent = pickRentForMonth(room.rentHistory, p.month, room.monthlyRent);
    const charges  = room.recurringCharges
      .filter(c => (c.tenantId === null || c.tenantId === p.tenantId)
        && (!c.effectiveFrom || c.effectiveFrom <= p.month)
        && (!c.effectiveTo   || p.month <= c.effectiveTo))
      .reduce((s, c) => s + c.amount, 0);
    const newDue   = baseRent + charges;
    const wasPast  = p.month < currentMonth;
    const wasOverdue = p.status === "OVERDUE" || (wasPast && p.amountPaid < newDue);
    const newStatus  = resolveStatus(p.amountPaid, newDue, wasOverdue);
    if (newDue !== p.amountDue || newStatus !== p.status) {
      await prisma.payment.update({
        where: { id: p.id },
        data:  { amountDue: newDue, status: newStatus },
      });
      recomputed++;
    }
  }

  return NextResponse.json({ success: true, recomputed });
}
