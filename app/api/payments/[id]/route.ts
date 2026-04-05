import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { tenant: true, room: true },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payment);
}

function resolveStatus(paid: number, due: number, wasOverdue: boolean): string {
  if (paid >= due) return "PAID";
  if (paid > 0)   return "PARTIAL";
  return wasOverdue ? "OVERDUE" : "PENDING";
}

// DELETE = void/reverse a payment back to unpaid state
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await prisma.payment.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const isPast = current.month < currentMonth;

  const payment = await prisma.payment.update({
    where: { id },
    data:  {
      amountPaid: 0,
      method:     null,
      paidDate:   null,
      notes:      null,
      status:     isPast ? "OVERDUE" : "PENDING",
    },
  });
  return NextResponse.json(payment);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const current = await prisma.payment.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalEntered = Number(body.amountPaid);

  // Get ALL unpaid months for this tenant, oldest first.
  // This covers: overdue past months → current month → future months.
  const allUnpaid = await prisma.payment.findMany({
    where: {
      tenantId: current.tenantId,
      status:   { not: "PAID" },
    },
    orderBy: { month: "asc" },
  });

  let remaining = totalEntered;

  // When checkbox is checked: clear one-time charges first, then rent months
  if (body.applyToOneTimeCharges) {
    const unpaidCharges = await prisma.oneTimeCharge.findMany({
      where: { tenantId: current.tenantId, status: { not: "PAID" } },
      orderBy: { date: "asc" },
    });
    for (const c of unpaidCharges) {
      if (remaining <= 0) break;
      const balance = c.amount - c.amountPaid;
      if (balance <= 0) continue;
      const apply   = Math.min(remaining, balance);
      remaining    -= apply;
      const newPaid = c.amountPaid + apply;
      await prisma.oneTimeCharge.update({
        where: { id: c.id },
        data: { amountPaid: newPaid, status: newPaid >= c.amount ? "PAID" : "PARTIAL" },
      });
    }
  }

  for (const p of allUnpaid) {
    if (remaining <= 0) break;
    const balance = p.amountDue - p.amountPaid;
    if (balance <= 0) continue;

    const apply   = Math.min(remaining, balance);
    remaining    -= apply;
    const newPaid = p.amountPaid + apply;

    await prisma.payment.update({
      where: { id: p.id },
      data: {
        amountPaid: newPaid,
        status:     resolveStatus(newPaid, p.amountDue, p.status === "OVERDUE"),
        method:     body.method  || null,
        paidDate:   body.paidDate ? new Date(body.paidDate) : null,
        ...(p.id === id ? { notes: body.notes || null } : {}),
      },
    });
  }

  // Any excess beyond all known unpaid months/charges → save as credit balance for future months
  if (remaining > 0) {
    await prisma.tenant.update({
      where: { id: current.tenantId },
      data:  { creditBalance: { increment: remaining } },
    });
  }

  const updated = await prisma.payment.findUnique({
    where: { id },
    include: { tenant: true, room: true },
  });
  return NextResponse.json(updated);
}
