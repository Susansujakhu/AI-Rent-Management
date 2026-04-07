import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const expenses = await prisma.expense.findMany({
    where: category ? { category } : undefined,
    include: { room: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(expenses);
}

export async function POST(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
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

  const expense = await prisma.expense.create({
    data: {
      title: body.title.trim(),
      amount,
      date: new Date(body.date),
      category: body.category || "OTHER",
      roomId: body.roomId || null,
      description: body.description || null,
    },
  });
  return NextResponse.json(expense, { status: 201 });
}
