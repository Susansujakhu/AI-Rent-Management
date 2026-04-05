import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function POST(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { paymentIds, method = "CASH" } = await req.json() as { paymentIds: string[]; method?: string };
  if (!paymentIds?.length) return NextResponse.json({ error: "No payments selected" }, { status: 400 });

  const today = new Date();
  await prisma.payment.updateMany({
    where: { id: { in: paymentIds }, status: { not: "PAID" } },
    data: { amountPaid: undefined, status: "PAID", method, paidDate: today },
  });

  const unpaid = await prisma.payment.findMany({
    where: { id: { in: paymentIds } },
    select: { id: true, amountDue: true },
  });
  await Promise.all(
    unpaid.map(p =>
      prisma.payment.update({
        where: { id: p.id },
        data: { amountPaid: p.amountDue, status: "PAID", method, paidDate: today },
      })
    )
  );

  return NextResponse.json({ ok: true, count: unpaid.length });
}
