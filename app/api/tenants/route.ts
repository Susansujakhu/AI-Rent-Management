import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET() {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const tenants = await prisma.tenant.findMany({
    include: { room: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tenants);
}

export async function POST(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
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
