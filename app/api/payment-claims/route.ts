import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Owner-facing: list payment claims reported by tenants. Pending first.
export async function GET() {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const claims = await prisma.paymentClaim.findMany({
    where:   { userId: auth.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take:    100,
    include: {
      tenant:  { select: { id: true, name: true, room: { select: { name: true } } } },
      payment: { select: { id: true, month: true } },
    },
  });

  return NextResponse.json(claims);
}
