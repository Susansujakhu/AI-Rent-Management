import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
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
  const body = await req.json();
  const expense = await prisma.expense.create({
    data: {
      title: body.title,
      amount: Number(body.amount),
      date: new Date(body.date),
      category: body.category || "OTHER",
      roomId: body.roomId || null,
      description: body.description || null,
    },
  });
  return NextResponse.json(expense, { status: 201 });
}
