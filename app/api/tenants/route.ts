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

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.phone || typeof body.phone !== "string" || !body.phone.trim()) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }
  if (!body.moveInDate || isNaN(new Date(body.moveInDate).getTime())) {
    return NextResponse.json({ error: "moveInDate must be a valid date" }, { status: 400 });
  }
  const deposit = Number(body.deposit) || 0;
  if (!Number.isFinite(deposit) || deposit < 0) {
    return NextResponse.json({ error: "deposit must be a non-negative number" }, { status: 400 });
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: body.name.trim(),
      phone: body.phone.trim(),
      email: body.email || null,
      roomId: body.roomId || null,
      moveInDate: new Date(body.moveInDate),
      deposit,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(tenant, { status: 201 });
}
