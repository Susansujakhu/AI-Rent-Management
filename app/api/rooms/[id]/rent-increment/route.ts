import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { pickRentForMonth } from "@/lib/rent-history";

// POST /api/rooms/[id]/rent-increment
// Body: { amount, effectiveFrom, reason?, applyToUnpaid }
//
// Inserts a RentHistory row, updates Room.monthlyRent (denormalised cache of
// the *latest* row), and — when applyToUnpaid is true — recomputes amountDue
// on any Payment with month >= effectiveFrom AND amountPaid = 0. Bills with
// any money applied (PAID / PARTIAL) are never touched.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id: roomId } = await params;

  const body = await req.json().catch(() => ({})) as {
    amount?:        unknown;
    effectiveFrom?: unknown;
    reason?:        unknown;
    applyToUnpaid?: unknown;
  };

  const amount        = Number(body.amount);
  const effectiveFrom = typeof body.effectiveFrom === "string" ? body.effectiveFrom : "";
  const reason        = typeof body.reason        === "string" ? body.reason.trim() : "";
  const applyToUnpaid = !!body.applyToUnpaid;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveFrom)) {
    return NextResponse.json({ error: "effectiveFrom must be YYYY-MM" }, { status: 400 });
  }

  const room = await prisma.room.findFirst({
    where: { id: roomId, userId },
    include: {
      rentHistory:      { orderBy: { effectiveFrom: "desc" } },
      recurringCharges: true,
    },
  });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  // New rent must be on or after the latest existing entry — no backdating
  // past previous history rows.
  const latest = room.rentHistory[0];
  if (latest && effectiveFrom <= latest.effectiveFrom) {
    return NextResponse.json(
      { error: `effectiveFrom must be after ${latest.effectiveFrom} (last rent change)` },
      { status: 400 },
    );
  }

  // Insert the new history row.
  const inserted = await prisma.rentHistory.create({
    data: {
      userId,
      roomId,
      amount,
      effectiveFrom,
      reason: reason || null,
    },
  });

  // Keep Room.monthlyRent in sync as the cached "current" rate so anything
  // that still reads it directly stays correct.
  await prisma.room.update({
    where: { id: roomId },
    data:  { monthlyRent: amount },
  });

  let recomputed = 0;
  if (applyToUnpaid) {
    // Fetch the full history including the row we just added so we can
    // resolve the right rent for each month.
    const history = [...room.rentHistory, { effectiveFrom, amount }];

    const today        = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const bills = await prisma.payment.findMany({
      where: {
        userId,
        roomId,
        month:  { gte: effectiveFrom },
        status: { not: "PAID" },                // PAID bills stay locked
      },
      select: { id: true, month: true, tenantId: true, amountPaid: true, status: true },
    });

    for (const b of bills) {
      const baseRent = pickRentForMonth(history, b.month, amount);
      const chargesForMonth = room.recurringCharges
        .filter(c => (c.tenantId === null || c.tenantId === b.tenantId)
          && (!c.effectiveFrom || c.effectiveFrom <= b.month)
          && (!c.effectiveTo   || b.month <= c.effectiveTo))
        .reduce((s, c) => s + c.amount, 0);
      const newDue     = baseRent + chargesForMonth;
      const wasOverdue = b.status === "OVERDUE" || b.month < currentMonth;
      const newStatus  = newDue > 0 && b.amountPaid >= newDue ? "PAID"
        : b.amountPaid > 0                                     ? "PARTIAL"
        : wasOverdue                                           ? "OVERDUE" : "PENDING";
      await prisma.payment.update({
        where: { id: b.id },
        data:  { amountDue: newDue, status: newStatus },
      });
      recomputed++;
    }
  }

  return NextResponse.json({ ok: true, history: inserted, recomputed });
}
