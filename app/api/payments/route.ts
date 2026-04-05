import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { searchParams } = new URL(req.url);
  const month    = searchParams.get("month");
  const tenantId = searchParams.get("tenantId");
  const after    = searchParams.get("after");
  const status   = searchParams.get("status"); // "unpaid" = exclude PAID

  const payments = await prisma.payment.findMany({
    where: {
      ...(month    ? { month }    : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(after    ? { month: { gt: after } } : {}),
      ...(status === "unpaid" ? { status: { not: "PAID" } } : {}),
    },
    include: { tenant: true, room: true },
    orderBy: [{ month: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(payments);
}
