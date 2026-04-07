import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAPI } from "@/lib/tenant-auth";

export async function GET() {
  const { tenant, unauth } = await requireTenantAPI();
  if (unauth) return unauth;

  // tenantId comes from the validated session — never from a query param
  const tenantId = tenant!.tenant.id;

  const payments = await prisma.payment.findMany({
    where:   { tenantId },
    include: { room: { select: { name: true } } },
    orderBy: { month: "desc" },
  });

  return NextResponse.json(payments);
}
