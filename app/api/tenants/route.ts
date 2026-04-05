import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tenants = await prisma.tenant.findMany({
    include: { room: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tenants);
}

export async function POST(req: Request) {
  const body = await req.json();
  const tenant = await prisma.tenant.create({
    data: {
      name: body.name,
      phone: body.phone,
      email: body.email || null,
      roomId: body.roomId || null,
      moveInDate: new Date(body.moveInDate),
      deposit: Number(body.deposit) || 0,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(tenant, { status: 201 });
}
