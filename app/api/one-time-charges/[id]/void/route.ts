import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

// POST — reverse a paid/partial charge back to unpaid (PENDING)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;

  const current = await prisma.oneTimeCharge.findUnique({ where: { id, userId } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (current.amountPaid <= 0) return NextResponse.json({ error: "Charge has no payment to void" }, { status: 400 });

  // Delete all ChargeTransaction records for this charge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).chargeTransaction.deleteMany({ where: { chargeId: id } });

  // Reset charge back to unpaid
  const charge = await prisma.oneTimeCharge.update({
    where: { id, userId },
    data:  { amountPaid: 0, status: "PENDING" },
  });

  return NextResponse.json(charge);
}
