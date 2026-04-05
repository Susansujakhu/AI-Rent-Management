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

  const adding  = Number(body.amountPaid);
  const newPaid = current.amountPaid + adding;

  let status: string;
  if (newPaid >= current.amount) status = "PAID";
  else if (newPaid > 0)          status = "PARTIAL";
  else                           status = "PENDING";

  const charge = await prisma.oneTimeCharge.update({
    where: { id },
    data:  { amountPaid: newPaid, status, notes: body.notes || current.notes },
  });
  return NextResponse.json(charge);
}
