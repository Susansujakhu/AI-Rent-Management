import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title, amount, effectiveFrom } = await req.json();
  if (!title || !amount) {
    return NextResponse.json({ error: "title and amount are required" }, { status: 400 });
  }
  const charge = await prisma.recurringCharge.create({
    data: {
      roomId: id,
      title: title.trim(),
      amount: Number(amount),
      effectiveFrom: effectiveFrom || null,
    },
  });
  return NextResponse.json(charge);
}
