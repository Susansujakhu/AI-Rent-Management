import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// PATCH — update role, plan, billing cycle, expiry, etc.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  if (id === auth.id) {
    return NextResponse.json({ error: "Cannot modify your own account from here" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if ("role"          in body) data.role          = body.role;
  if ("plan"          in body) data.plan          = body.plan;
  if ("planExpiresAt" in body) data.planExpiresAt = body.planExpiresAt ? new Date(body.planExpiresAt as string) : null;
  if ("billingCycle"  in body) data.billingCycle  = body.billingCycle ?? null;
  if ("phoneVerified" in body) data.phoneVerified = body.phoneVerified;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (data.role && !["user", "admin"].includes(data.role as string)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (data.plan && !["free", "basic", "starter", "pro"].includes(data.plan as string)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (data.billingCycle && !["monthly", "yearly", "lifetime"].includes(data.billingCycle as string)) {
    return NextResponse.json({ error: "Invalid billing cycle" }, { status: 400 });
  }

  // Downgrading to free → clear expiry and billing cycle
  if (data.plan === "free") {
    data.planExpiresAt = null;
    data.billingCycle  = null;
  }

  // Lifetime → no expiry
  if (data.billingCycle === "lifetime") {
    data.planExpiresAt = null;
  }

  // Activating a paid plan → clear pending upgrade request fields
  if (data.plan && data.plan !== "free") {
    data.upgradeRequestedAt  = null;
    data.pendingPlan         = null;
    data.pendingBillingCycle = null;
  }

  // Snapshot current plan before update
  const prev = await prisma.user.findUnique({
    where:  { id },
    select: { plan: true, billingCycle: true },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.user.update as any)({
    where: { id },
    data,
    select: {
      id:                  true,
      email:               true,
      role:                true,
      plan:                true,
      planExpiresAt:       true,
      billingCycle:        true,
      phoneVerified:       true,
      pendingPlan:         true,
      pendingBillingCycle: true,
      upgradeRequestedAt:  true,
    },
  });

  // Log to subscription history whenever plan changes
  if (data.plan && prev && data.plan !== prev.plan) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).subscriptionHistory.create({
      data: {
        userId:      id,
        plan:        data.plan as string,
        billingCycle: (data.billingCycle ?? prev.billingCycle ?? null) as string | null,
        expiresAt:   (data.planExpiresAt as Date | null) ?? null,
        note:        `Plan changed from ${prev.plan} to ${data.plan} by admin`,
        changedBy:   "admin",
      },
    });
  }

  return NextResponse.json(user);
}

// DELETE — permanently delete a user and all their data (cascade)
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  if (id === auth.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
