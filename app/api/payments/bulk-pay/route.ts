import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { PAYMENT_METHODS } from "@/lib/utils";

export async function POST(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { paymentIds, method = "CASH" } = await req.json() as { paymentIds: string[]; method?: string };
  if (!paymentIds?.length) return NextResponse.json({ error: "No payments selected" }, { status: 400 });
  if (!PAYMENT_METHODS.includes(method as typeof PAYMENT_METHODS[number])) {
    return NextResponse.json({ error: `method must be one of: ${PAYMENT_METHODS.join(", ")}` }, { status: 400 });
  }

  const today = new Date();

  const unpaid = await prisma.payment.findMany({
    where: { id: { in: paymentIds }, status: { not: "PAID" } },
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
