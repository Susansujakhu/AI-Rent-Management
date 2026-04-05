import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { chargeId } = await params;
  await prisma.recurringCharge.delete({ where: { id: chargeId } });
  return NextResponse.json({ success: true });
}
