import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list all users with stats
export async function GET() {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await (prisma.user.findMany as any)({
    select: {
      id:            true,
      email:         true,
      name:          true,
      phone:         true,
      phoneVerified: true,
      role:          true,
      plan:                true,
      planExpiresAt:       true,
      billingCycle:        true,
      pendingPlan:         true,
      pendingBillingCycle: true,
      upgradeRequestedAt:  true,
      createdAt:           true,
      _count: {
        select: { tenants: true, rooms: true, payments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
