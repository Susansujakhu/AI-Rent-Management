import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { room: true },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(expense);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const expense = await prisma.expense.update({
    where: { id },
    data: {
      title: body.title,
      amount: Number(body.amount),
      date: new Date(body.date),
      category: body.category || "OTHER",
      roomId: body.roomId || null,
      description: body.description || null,
    },
  });
  return NextResponse.json(expense);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
