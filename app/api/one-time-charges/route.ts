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
  const charge = await prisma.oneTimeCharge.create({
    data: {
      tenantId: body.tenantId,
      title:    body.title,
      amount:   Number(body.amount),
      date:     new Date(body.date),
      notes:    body.notes || null,
    },
  });
  return NextResponse.json(charge);
}
