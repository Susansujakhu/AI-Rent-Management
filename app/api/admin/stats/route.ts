import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/pricing";

const FREE_TRIAL_DAYS = 90;

export async function GET() {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  const now             = new Date();
  const in7Days         = new Date(now.getTime() +  7 * 86_400_000);
  const in30Days        = new Date(now.getTime() + 30 * 86_400_000);

  // ── All users (lightweight) ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allUsers = await (prisma.user.findMany as any)({
    select: {
      id:                 true,
      email:              true,
      name:               true,
      plan:               true,
      planExpiresAt:      true,
      billingCycle:       true,
      upgradeRequestedAt: true,
      phoneVerified:      true,
      createdAt:          true,
    },
  }) as {
    id: string; email: string; name: string | null;
    plan: string; planExpiresAt: Date | null; billingCycle: string | null;
    upgradeRequestedAt: Date | null; phoneVerified: boolean; createdAt: Date;
  }[];

  // ── Plan / status bucketing ────────────────────────────────────────────────
  const byPlan = { free: 0, basic: 0, starter: 0, pro: 0 };
  let onTrial = 0, expiredCount = 0;

  for (const u of allUsers) {
    const isPaid = ["basic", "starter", "pro"].includes(u.plan);

    if (isPaid) {
      const active = !u.planExpiresAt || u.planExpiresAt > now;
      if (active) {
        byPlan[u.plan as keyof typeof byPlan]++;
      } else {
        expiredCount++;
        byPlan.free++; // counted as free since effectively downgraded
      }
    } else {
      byPlan.free++;
      const trialEnd = new Date(u.createdAt);
      trialEnd.setDate(trialEnd.getDate() + FREE_TRIAL_DAYS);
      if (trialEnd > now) onTrial++;
      else expiredCount++;
    }
  }

  // ── MRR estimate ──────────────────────────────────────────────────────────
  let mrr = 0;
  for (const u of allUsers) {
    if (!["basic", "starter", "pro"].includes(u.plan)) continue;
    if (u.planExpiresAt && u.planExpiresAt <= now) continue;
    const plan = PLANS[u.plan as keyof typeof PLANS];
    if (!plan) continue;
    if (u.billingCycle === "lifetime") continue; // one-time payment — not recurring
    mrr += u.billingCycle === "yearly"
      ? plan.yearly.amount / 12
      : plan.monthly.amount;
  }

  // ── Expiring soon ──────────────────────────────────────────────────────────
  const expiringSoon = allUsers
    .filter(u =>
      u.planExpiresAt &&
      u.planExpiresAt > now &&
      u.planExpiresAt <= in30Days &&
      ["basic", "starter", "pro"].includes(u.plan)
    )
    .sort((a, b) => a.planExpiresAt!.getTime() - b.planExpiresAt!.getTime())
    .slice(0, 10)
    .map(u => ({
      id:           u.id,
      email:        u.email,
      name:         u.name,
      plan:         u.plan,
      planExpiresAt: u.planExpiresAt!.toISOString(),
      billingCycle:  u.billingCycle,
      daysLeft:      Math.ceil((u.planExpiresAt!.getTime() - now.getTime()) / 86_400_000),
    }));

  // ── User growth — last 12 months ───────────────────────────────────────────
  const growthMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    growthMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
  }
  for (const u of allUsers) {
    const d   = new Date(u.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in growthMap) growthMap[key]++;
  }
  const growth = Object.entries(growthMap).map(([month, count]) => ({ month, count }));

  // ── Recent subscription activity ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentActivity = await (prisma as any).subscriptionHistory.findMany({
    take:    10,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, name: true } } },
  });

  // ── Pending upgrades ──────────────────────────────────────────────────────
  const pendingUsers = allUsers
    .filter(u => !!u.upgradeRequestedAt)
    .map(u => ({ id: u.id, email: u.email, name: u.name, upgradeRequestedAt: u.upgradeRequestedAt!.toISOString() }));

  return NextResponse.json({
    users: {
      total:          allUsers.length,
      byPlan,
      onTrial,
      expired:        expiredCount,
      pendingUpgrade: pendingUsers.length,
      verified:       allUsers.filter(u => u.phoneVerified).length,
    },
    revenue: {
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
    },
    expiringSoon,
    expiring7Days: expiringSoon.filter(u => u.daysLeft <= 7).length,
    growth,
    recentActivity,
    pendingUsers,
  });
}
