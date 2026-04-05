import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  const { chargeId } = await params;
  await prisma.recurringCharge.delete({ where: { id: chargeId } });
  return NextResponse.json({ success: true });
}
