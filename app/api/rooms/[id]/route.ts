import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const room = await prisma.room.findUnique({
    where: { id },
    include: { tenants: { where: { moveOutDate: null } }, payments: true, expenses: true },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(room);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const body = await req.json();

  if (body.name !== undefined && (!body.name || typeof body.name !== "string" || !body.name.trim())) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
  }
  const newRent = Number(body.monthlyRent);
  if (!Number.isFinite(newRent) || newRent < 0) {
    return NextResponse.json({ error: "monthlyRent must be a non-negative number" }, { status: 400 });
  }

  const room = await prisma.room.update({
    where: { id },
    data: {
      name:        body.name,
      floor:       body.floor        || null,
      monthlyRent: newRent,
      description: body.description  || null,
    },
    include: { recurringCharges: true },
  });

  const newAmountDue = newRent + room.recurringCharges.reduce((s, c) => s + c.amount, 0);
  await prisma.payment.updateMany({
    where: { roomId: id, status: "PENDING", amountPaid: 0 },
    data:  { amountDue: newAmountDue },
  });

  return NextResponse.json(room);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const activeTenant = await prisma.tenant.findFirst({
    where: { roomId: id, moveOutDate: null },
  });
  if (activeTenant) {
    return NextResponse.json(
      { error: `Cannot delete room with active tenant "${activeTenant.name}". Move them out first.` },
      { status: 400 }
    );
  }
  await prisma.room.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
