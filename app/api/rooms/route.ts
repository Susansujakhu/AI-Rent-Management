import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { canAddRoom, hasAccess, planLimitResponse, trialExpiredResponse, roomLimit } from "@/lib/plan";

export async function GET() {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const rooms = await prisma.room.findMany({
    where: { userId },
    include: { tenants: { where: { moveOutDate: null } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const body = await req.json();

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const monthlyRent = Number(body.monthlyRent);
  if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
    return NextResponse.json({ error: "monthlyRent must be a non-negative number" }, { status: 400 });
  }

  if (!hasAccess(auth)) return trialExpiredResponse();

  const count = await prisma.room.count({ where: { userId } });
  if (!canAddRoom(auth, count)) {
    const limit = roomLimit(auth);
    return planLimitResponse(`Your plan allows up to ${limit} rooms. Upgrade to add more.`);
  }

  const room = await prisma.room.create({
    data: {
      userId,
      name: body.name.trim(),
      floor: body.floor || null,
      monthlyRent,
      description: body.description || null,
    },
  });
  return NextResponse.json(room, { status: 201 });
}
