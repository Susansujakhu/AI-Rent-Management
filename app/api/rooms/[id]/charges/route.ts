import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
  const { title, amount, effectiveFrom } = await req.json();
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (effectiveFrom && !/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveFrom)) {
    return NextResponse.json({ error: "effectiveFrom must be in YYYY-MM format" }, { status: 400 });
  }
  // Verify the room belongs to this user before creating a charge for it
  const room = await prisma.room.findUnique({ where: { id, userId }, select: { id: true } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const charge = await prisma.recurringCharge.create({
    data: {
      userId,
      roomId: id,
      title: title.trim(),
      amount: parsedAmount,
      effectiveFrom: effectiveFrom || null,
    },
  });
  return NextResponse.json(charge);
}
