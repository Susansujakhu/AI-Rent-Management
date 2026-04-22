import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { chargeId } = await params;
  await prisma.recurringCharge.delete({ where: { id: chargeId, userId } });
  return NextResponse.json({ success: true });
}
