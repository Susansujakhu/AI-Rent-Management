import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rooms = await prisma.room.findMany({
    include: { tenants: { where: { moveOutDate: null } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  const body = await req.json();
  const room = await prisma.room.create({
    data: {
      name: body.name,
      floor: body.floor || null,
      monthlyRent: Number(body.monthlyRent),
      description: body.description || null,
    },
  });
  return NextResponse.json(room, { status: 201 });
}
