import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAPIByToken } from "@/lib/tenant-auth";

export async function GET(req: Request) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const charges = await prisma.oneTimeCharge.findMany({
    where:   { tenantId: tenant!.id },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(charges);
}
