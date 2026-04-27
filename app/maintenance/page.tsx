export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Hammer } from "lucide-react";
import { MaintenanceClient, type MRequest } from "./maintenance-client";

export const metadata = { title: "Maintenance" };

export default async function MaintenancePage() {
  try {
    const user = await requireAuth();

    const requests = await prisma.maintenanceRequest.findMany({
      where:   { userId: user.id },
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

    const serialized: MRequest[] = requests.map(r => ({
      ...r,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      createdAt:  r.createdAt.toISOString(),
      updatedAt:  r.updatedAt.toISOString(),
    }));

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Hammer size={20} className="text-slate-500" />
            Maintenance Requests
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {requests.length} total · tenants submit via their portal
          </p>
        </div>
        <MaintenanceClient initial={serialized} />
      </div>
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return (
      <pre style={{padding:"1rem",color:"red",background:"#fff0f0",borderRadius:"8px",fontSize:"12px",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
        MAINTENANCE PAGE ERROR:{"\n"}{String(err?.message ?? err)}{"\n\n"}{String(err?.stack ?? "")}
      </pre>
    );
  }
}
