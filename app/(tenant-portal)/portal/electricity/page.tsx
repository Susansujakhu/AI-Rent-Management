export const dynamic = "force-dynamic";

import { requireTenantPage } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { PortalShell } from "../_components/portal-shell";
import { ElectricityPortalClient, type PortalReading } from "./electricity-client";
import { Zap } from "lucide-react";

export const metadata = { title: "Electricity" };

export default async function PortalElectricityPage() {
  const session = await requireTenantPage();
  const tenant  = session.tenant;

  if (!tenant.canSubmitMeterReading) {
    return (
      <PortalShell tenantName={tenant.name} roomName={tenant.room?.name ?? null} showElectricity={tenant.canSubmitMeterReading}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Zap size={24} className="text-slate-300" />
          </div>
          <p className="font-bold text-slate-600">Not enabled for your unit</p>
          <p className="text-sm text-slate-400 mt-1">Contact your landlord to enable meter reading submission.</p>
        </div>
      </PortalShell>
    );
  }

  // Get owner's electricity rate
  const rateSetting = await prisma.setting.findUnique({
    where: { userId_key: { userId: tenant.userId, key: "electricityRate" } },
  });
  const ratePerUnit = parseFloat(rateSetting?.value ?? "0");

  // Get all readings for this tenant
  const readings = await prisma.meterReading.findMany({
    where:   { tenantId: tenant.id },
    orderBy: { month: "desc" },
  });

  const serialized: PortalReading[] = readings.map(r => ({
    id:                r.id,
    month:             r.month,
    previous:          r.previous,
    current:           r.current,
    ratePerUnit:       r.ratePerUnit,
    unitsUsed:         r.unitsUsed,
    amount:            r.amount,
    chargeId:          r.chargeId,
    photoPath:         r.photoPath,
    notes:             r.notes,
    status:            r.status,
    submittedByTenant: r.submittedByTenant,
  }));

  // Latest reading's current value for pre-filling previous field
  const lastCurrent = readings[0]?.current ?? null;

  return (
    <PortalShell tenantName={tenant.name} roomName={tenant.room?.name ?? null} showElectricity={tenant.canSubmitMeterReading}>
      <ElectricityPortalClient
        initialReadings={serialized}
        ratePerUnit={ratePerUnit}
        lastCurrent={lastCurrent}
      />
    </PortalShell>
  );
}
