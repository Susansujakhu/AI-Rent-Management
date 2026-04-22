import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Verify the payment belongs to this user and get tenantId for charge lookup
  const payment = await prisma.payment.findUnique({
    where: { id, userId: auth.id },
    select: { id: true, tenantId: true },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rentTxns = await (prisma as any).paymentTransaction.findMany({
    where:   { paymentId: id },
    orderBy: { paidAt: "asc" },
    select:  { id: true, amount: true, creditAmount: true, method: true, paidAt: true, note: true },
  }) as { id: string; amount: number; creditAmount: number; method: string | null; paidAt: Date; note: string | null }[];

  // For each unique paidAt in this payment's transactions, also fetch charge transactions
  // from the same session (same tenant + same paidAt timestamp)
  const paidAts = [...new Set(rentTxns.map(t => t.paidAt.toISOString()))];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chargeTxns = paidAts.length > 0 ? await (prisma as any).chargeTransaction.findMany({
    where:   { userId: auth.id, tenantId: payment.tenantId, paidAt: { in: paidAts.map(d => new Date(d)) } },
    orderBy: { paidAt: "asc" },
    select:  { id: true, chargeTitle: true, amount: true, method: true, paidAt: true, note: true },
  }) as { id: string; chargeTitle: string; amount: number; method: string | null; paidAt: Date; note: string | null }[] : [];

  // Merge and sort by paidAt, marking each with type
  const result = [
    ...rentTxns.map(t => ({ ...t, type: "payment" as const, label: null, creditAmount: t.creditAmount })),
    ...chargeTxns.map(t => ({ ...t, type: "charge" as const, label: t.chargeTitle, creditAmount: 0 })),
  ].sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

  return NextResponse.json(result);
}
