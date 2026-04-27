export const dynamic = "force-dynamic";

import { requireTenantPage } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { PortalShell } from "../_components/portal-shell";
import { MaintenancePortalClient } from "./maintenance-portal-client";

export default async function PortalMaintenancePage() {
  const session = await requireTenantPage();
  const tenant  = session.tenant;

  const requests = await prisma.maintenanceRequest.findMany({
    where:   { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    select: {
      id:          true,
      title:       true,
      description: true,
      category:    true,
      priority:    true,
      status:      true,
      notes:       true,
      resolvedAt:  true,
      createdAt:   true,
    },
  });

  const serialized = requests.map(r => ({
    ...r,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    createdAt:  r.createdAt.toISOString(),
  }));

  return (
    <PortalShell tenantName={tenant.name} roomName={tenant.room?.name ?? null} showElectricity={tenant.canSubmitMeterReading}>
      <MaintenancePortalClient initial={serialized} />
    </PortalShell>
  );
}
