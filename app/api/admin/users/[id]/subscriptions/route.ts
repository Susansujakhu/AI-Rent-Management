import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// GET — subscription history for a user
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history = await (prisma as any).subscriptionHistory.findMany({
    where:   { userId: id },
    orderBy: { createdAt: "desc" },
    take:    50,
  });

  return NextResponse.json(history);
}
