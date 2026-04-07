import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET() {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const rooms = await prisma.room.findMany({
    include: { tenants: { where: { moveOutDate: null } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const body = await req.json();

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const monthlyRent = Number(body.monthlyRent);
  if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
    return NextResponse.json({ error: "monthlyRent must be a non-negative number" }, { status: 400 });
  }

  const room = await prisma.room.create({
    data: {
      name: body.name.trim(),
      floor: body.floor || null,
      monthlyRent,
      description: body.description || null,
    },
  });
  return NextResponse.json(room, { status: 201 });
}
