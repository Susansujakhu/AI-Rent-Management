import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const status   = searchParams.get("status"); // "unpaid" = exclude PAID

  const charges = await prisma.oneTimeCharge.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(status === "unpaid" ? { status: { not: "PAID" } } : {}),
    },
  });
  return NextResponse.json(charges);
}

export async function POST(req: Request) {
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
