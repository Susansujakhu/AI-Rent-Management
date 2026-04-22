import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { PAYMENT_METHODS } from "@/lib/utils";

// PATCH — edit charge details (title, amount, date, notes). Only allowed for non-PAID charges.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
  const body = await req.json();

  const current = await prisma.oneTimeCharge.findUnique({ where: { id, userId } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (current.status === "PAID") return NextResponse.json({ error: "Cannot edit a fully paid charge" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (!String(body.title).trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
    data.title = String(body.title).trim();
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    data.amount = amount;
    // Recompute status based on new amount
    data.status = current.amountPaid >= amount ? "PAID" : current.amountPaid > 0 ? "PARTIAL" : "PENDING";
  }
  if (body.date !== undefined) {
    const d = new Date(body.date);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "date must be a valid date" }, { status: 400 });
    data.date = d;
  }
  if ("notes" in body) data.notes = body.notes || null;

  const charge = await prisma.oneTimeCharge.update({ where: { id, userId }, data });
  return NextResponse.json(charge);
}

// DELETE — void/remove a charge. Only allowed for non-PAID charges.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;

  const current = await prisma.oneTimeCharge.findUnique({ where: { id, userId } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (current.status === "PAID") return NextResponse.json({ error: "Cannot void a fully paid charge" }, { status: 400 });

  await prisma.oneTimeCharge.delete({ where: { id, userId } });
  return NextResponse.json({ success: true });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
  const charge = await prisma.oneTimeCharge.findUnique({
    where: { id, userId },
    include: { tenant: true },
  });
  if (!charge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(charge);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
  const body    = await req.json();

  const current = await prisma.oneTimeCharge.findUnique({
    where: { id, userId },
    include: { tenant: { select: { id: true } } },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (current.status === "PAID") {
    return NextResponse.json({ error: "Charge is already fully paid" }, { status: 400 });
  }

  const adding = Number(body.amountPaid);
  if (!Number.isFinite(adding) || adding <= 0) {
    return NextResponse.json({ error: "amountPaid must be a positive number" }, { status: 400 });
  }
  if (body.method && !PAYMENT_METHODS.includes(body.method as typeof PAYMENT_METHODS[number])) {
    return NextResponse.json({ error: `method must be one of: ${PAYMENT_METHODS.join(", ")}` }, { status: 400 });
  }

  const remaining = current.amount - current.amountPaid;
  const applied   = Math.min(adding, remaining);
  const newPaid   = current.amountPaid + applied;
  const paidAt    = body.paidDate && !isNaN(new Date(body.paidDate).getTime())
    ? new Date(body.paidDate)
    : new Date();

  let status: string;
  if (newPaid >= current.amount) status = "PAID";
  else if (newPaid > 0)          status = "PARTIAL";
  else                           status = "PENDING";

  const charge = await prisma.oneTimeCharge.update({
    where: { id, userId },
    data:  { amountPaid: newPaid, status, notes: body.notes ?? current.notes },
  });

  // Record in ledger so it shows in payment history
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).chargeTransaction.create({
    data: {
      userId,
      tenantId:    current.tenantId,
      chargeId:    id,
      chargeTitle: current.title,
      amount:      applied,
      method:      body.method || null,
      paidAt,
      note:        body.notes || null,
    },
  });

  return NextResponse.json(charge);
}
