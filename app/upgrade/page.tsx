import { requireAuth } from "@/lib/auth";
import { getPlanStatus, trialDaysLeft } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { UpgradeClient } from "./upgrade-client";

export default async function UpgradePage() {
  const user   = await requireAuth();
  const status = getPlanStatus(user);
  const days   = trialDaysLeft(user);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbUser = await (prisma.user.findUnique as any)({
    where:  { id: user.id },
    select: { upgradeRequestedAt: true },
  }) as { upgradeRequestedAt: Date | null } | null;

  return (
    <UpgradeClient
      planStatus={status}
      trialDaysLeft={days}
      upgradeRequestedAt={dbUser?.upgradeRequestedAt?.toISOString() ?? null}
    />
  );
}
