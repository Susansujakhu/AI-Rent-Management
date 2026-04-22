import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { hasAccess, trialExpiredResponse } from "@/lib/plan";

export async function GET() {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const tenants = await prisma.tenant.findMany({
    where: { userId },
    include: { room: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tenants);
}

export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
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

  if (!hasAccess(auth)) return trialExpiredResponse();

  const tenant = await prisma.tenant.create({
    data: {
      userId,
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
