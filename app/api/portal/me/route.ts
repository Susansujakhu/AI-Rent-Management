import { NextResponse } from "next/server";
import { requireTenantAPIByToken } from "@/lib/tenant-auth";

export async function GET(req: Request) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const t = tenant!;
  return NextResponse.json({
    id:            t.id,
    name:          t.name,
    phone:         t.phone,
    email:         t.email,
    moveInDate:    t.moveInDate,
    moveOutDate:   t.moveOutDate,
    deposit:       t.deposit,
    creditBalance: t.creditBalance,
    room:          t.room ? { id: t.room.id, name: t.room.name, floor: t.room.floor } : null,
    canSubmitMeterReading: t.canSubmitMeterReading,
  });
}
