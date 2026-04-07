import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const charge = await prisma.oneTimeCharge.findUnique({
    where: { id },
    include: { tenant: true },
  });
  if (!charge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(charge);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const body    = await req.json();

  const current = await prisma.oneTimeCharge.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (current.status === "PAID") {
    return NextResponse.json({ error: "Charge is already fully paid" }, { status: 400 });
  }

  const adding = Number(body.amountPaid);
  if (!Number.isFinite(adding) || adding <= 0) {
    return NextResponse.json({ error: "amountPaid must be a positive number" }, { status: 400 });
  }

  const remaining = current.amount - current.amountPaid;
  const applied   = Math.min(adding, remaining);
  const newPaid   = current.amountPaid + applied;

  let status: string;
  if (newPaid >= current.amount) status = "PAID";
  else if (newPaid > 0)          status = "PARTIAL";
  else                           status = "PENDING";

  const charge = await prisma.oneTimeCharge.update({
    where: { id },
    data:  { amountPaid: newPaid, status, notes: body.notes ?? current.notes },
  });
  return NextResponse.json(charge);
}
