export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Zap } from "lucide-react";
import { ElectricityClient } from "./electricity-client";

export const metadata = { title: "Electricity" };

export default async function ElectricityPage() {
  const user = await requireAuth();

  const [tenants, settings] = await Promise.all([
    prisma.tenant.findMany({
      where:   { userId: user.id, moveOutDate: null },
      select:  { id: true, name: true, room: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findMany({ where: { userId: user.id, key: "electricityRate" } }),
  ]);

  const defaultRate = parseFloat(settings[0]?.value ?? "0") || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Zap size={20} className="text-amber-500" />
          Electricity Meter
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Record meter readings per tenant · auto-calculates bill · creates charge
        </p>
      </div>
      <ElectricityClient tenants={tenants} defaultRate={defaultRate} />
    </div>
  );
}
