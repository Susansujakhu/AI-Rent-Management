import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAPI } from "@/lib/tenant-auth";

export async function GET() {
  const { tenant, unauth } = await requireTenantAPI();
  if (unauth) return unauth;

  const tenantId = tenant!.tenant.id;

  const charges = await prisma.oneTimeCharge.findMany({
    where:   { tenantId },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(charges);
}
