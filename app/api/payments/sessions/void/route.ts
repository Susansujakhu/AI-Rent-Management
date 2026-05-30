import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

// Void a single payment session — scoped strictly to transactions matching
// (tenantId, paidAt). Reverses rent applications, one-time-charge applications,
// and any advance credit that was generated in this session. Other sessions on
// the same Payment row are left alone.
//
// Body: { tenantId: string, paidAt: string (ISO timestamp) }

function resolveStatus(paid: number, due: number, wasOverdue: boolean): string {
  if (paid >= due) return "PAID";
  if (paid > 0)    return "PARTIAL";
  return wasOverdue ? "OVERDUE" : "PENDING";
}

export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;

  const body = await req.json().catch(() => ({})) as { tenantId?: string; paidAt?: string };
  if (!body.tenantId || !body.paidAt) {
    return NextResponse.json({ error: "tenantId and paidAt required" }, { status: 400 });
  }
  const paidAt = new Date(body.paidAt);
  if (isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: "Invalid paidAt" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPaymentTxns = await (prisma as any).paymentTransaction.findMany({
    where:   { userId, paidAt },
    include: { payment: { select: { id: true, tenantId: true, amountDue: true, amountPaid: true, status: true, month: true } } },
  }) as Array<{
    id: string; paymentId: string; amount: number; creditAmount: number;
    payment: { id: string; tenantId: string; amountDue: number; amountPaid: number; status: string; month: string };
  }>;

  // Defensive: scope to the requested tenant in case two tenants happen to
  // share the exact same paidAt timestamp (unlikely but possible).
  const myPaymentTxns = allPaymentTxns.filter(t => t.payment.tenantId === body.tenantId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myChargeTxns = await (prisma as any).chargeTransaction.findMany({
    where: { userId, tenantId: body.tenantId, paidAt },
  }) as Array<{ id: string; chargeId: string; amount: number }>;

  if (myPaymentTxns.length === 0 && myChargeTxns.length === 0) {
    return NextResponse.json({ error: "No transactions found for this session" }, { status: 404 });
  }

  const today        = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const creditToRestore = myPaymentTxns.reduce((s, t) => s + (t.creditAmount ?? 0), 0);

  // Group payment txns by paymentId so a payment with multiple txns in this
  // session is reversed in one update.
  const txnsByPayment = new Map<string, typeof myPaymentTxns>();
  for (const t of myPaymentTxns) {
    if (!txnsByPayment.has(t.paymentId)) txnsByPayment.set(t.paymentId, []);
    txnsByPayment.get(t.paymentId)!.push(t);
  }

  for (const [paymentId, txns] of txnsByPayment) {
    const totalToReverse = txns.reduce((s, t) => s + t.amount, 0);
    const payment    = txns[0].payment;
    const newPaid    = Math.max(0, payment.amountPaid - totalToReverse);
    const wasOverdue = payment.month < currentMonth;

    // If after this void the payment has zero amountPaid AND no transactions
    // from other sessions remain, also clear method/paidDate/notes so it
    // returns to its untouched state.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const otherTxns = await (prisma as any).paymentTransaction.count({
      where: { paymentId, NOT: { paidAt } },
    }) as number;

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        amountPaid: newPaid,
        status:     resolveStatus(newPaid, payment.amountDue, wasOverdue),
        ...(newPaid === 0 && otherTxns === 0 ? { method: null, paidDate: null, notes: null } : {}),
      },
    });
  }

  // Reverse one-time charges
  for (const ct of myChargeTxns) {
    const charge = await prisma.oneTimeCharge.findUnique({
      where:  { id: ct.chargeId },
      select: { amount: true, amountPaid: true },
    });
    if (charge) {
      const newPaid = Math.max(0, charge.amountPaid - ct.amount);
      await prisma.oneTimeCharge.update({
        where: { id: ct.chargeId },
        data: {
          amountPaid: newPaid,
          status:     newPaid <= 0 ? "PENDING" : newPaid >= charge.amount ? "PAID" : "PARTIAL",
        },
      });
    }
  }

  // Restore advance credit (capped at current balance — never decrement below 0)
  if (creditToRestore > 0) {
    const tenant = await prisma.tenant.findUnique({
      where:  { id: body.tenantId },
      select: { creditBalance: true },
    });
    const restore = Math.min(creditToRestore, tenant?.creditBalance ?? 0);
    if (restore > 0) {
      await prisma.tenant.update({
        where: { id: body.tenantId },
        data:  { creditBalance: { decrement: restore } },
      });
    }
  }

  // Delete the transactions belonging to this session
  if (txnsByPayment.size > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).paymentTransaction.deleteMany({
      where: {
        userId,
        paidAt,
        paymentId: { in: Array.from(txnsByPayment.keys()) },
      },
    });
  }
  if (myChargeTxns.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).chargeTransaction.deleteMany({
      where: { userId, tenantId: body.tenantId, paidAt },
    });
  }

  return NextResponse.json({ ok: true });
}
