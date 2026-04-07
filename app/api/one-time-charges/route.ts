import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const status   = searchParams.get("status");

  const charges = await prisma.oneTimeCharge.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(status === "unpaid" ? { status: { not: "PAID" } } : {}),
    },
  });
  return NextResponse.json(charges);
}

export async function POST(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const body = await req.json();

  if (!body.tenantId || typeof body.tenantId !== "string") {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (!body.date || isNaN(new Date(body.date).getTime())) {
    return NextResponse.json({ error: "date must be a valid date" }, { status: 400 });
  }

  const charge = await prisma.oneTimeCharge.create({
    data: {
      tenantId: body.tenantId,
      title:    body.title.trim(),
      amount,
      date:     new Date(body.date),
      notes:    body.notes || null,
    },
  });
  return NextResponse.json(charge);
}
