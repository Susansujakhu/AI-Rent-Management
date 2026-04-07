import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { room: true },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(expense);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (!body.date || isNaN(new Date(body.date).getTime())) {
    return NextResponse.json({ error: "date must be a valid date" }, { status: 400 });
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      title: body.title.trim(),
      amount,
      date: new Date(body.date),
      category: body.category || "OTHER",
      roomId: body.roomId || null,
      description: body.description || null,
    },
  });
  return NextResponse.json(expense);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
