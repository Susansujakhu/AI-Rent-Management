import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status");
  const tenantId = searchParams.get("tenantId");

  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      userId: auth.id,
      ...(status   ? { status }   : {}),
      ...(tenantId ? { tenantId } : {}),
    },
    include: {
      tenant: {
        select: {
          id:   true,
          name: true,
          room: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}
