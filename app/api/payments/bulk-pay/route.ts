import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { PAYMENT_METHODS } from "@/lib/utils";

export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { paymentIds, method = "CASH" } = await req.json() as { paymentIds: string[]; method?: string };
  if (!paymentIds?.length) return NextResponse.json({ error: "No payments selected" }, { status: 400 });
  if (!PAYMENT_METHODS.includes(method as typeof PAYMENT_METHODS[number])) {
    return NextResponse.json({ error: `method must be one of: ${PAYMENT_METHODS.join(", ")}` }, { status: 400 });
  }

  const today = new Date();

  const unpaid = await prisma.payment.findMany({
    where: { id: { in: paymentIds }, userId, status: { not: "PAID" } },
    select: { id: true, amountDue: true, amountPaid: true },
  });

  if (unpaid.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  // Run as one transaction so a partial failure rolls back — and write matching
  // paymentTransaction ledger rows so void/refund flows can reverse these the
  // same way they reverse single-payment PUTs.
  await prisma.$transaction([
    ...unpaid.map(p =>
      prisma.payment.update({
        where: { id: p.id, userId },
        data:  { amountPaid: p.amountDue, status: "PAID", method, paidDate: today },
      })
    ),
    ...unpaid.map(p => {
      const delta = p.amountDue - p.amountPaid;
      return prisma.paymentTransaction.create({
        data: {
          userId,
          paymentId:    p.id,
          amount:       delta,
          creditAmount: 0,
          totalEntered: delta,
          method,
          paidAt:       today,
          note:         "Bulk pay",
        },
      });
    }),
  ]);

  return NextResponse.json({ ok: true, count: unpaid.length });
}
