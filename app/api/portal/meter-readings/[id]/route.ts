import { NextResponse } from "next/server";
import { requireTenantAPIByToken } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const t   = tenant!;
  const { id } = await params;

  const reading = await prisma.meterReading.findUnique({ where: { id } });
  if (!reading || reading.tenantId !== t.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (reading.status !== "pending_review") {
    return NextResponse.json({ error: "Cannot edit a confirmed reading" }, { status: 403 });
  }

  const body = await req.json() as { previous: number; current: number; notes?: string };
  const { previous, current, notes } = body;

  if (typeof previous !== "number" || typeof current !== "number") {
    return NextResponse.json({ error: "previous and current must be numbers" }, { status: 400 });
  }
  if (current < previous) {
    return NextResponse.json({ error: "Current cannot be less than previous" }, { status: 400 });
  }

  const unitsUsed = parseFloat((current - previous).toFixed(2));
  const amount    = parseFloat((unitsUsed * reading.ratePerUnit).toFixed(2));

  const updated = await prisma.meterReading.update({
    where: { id },
    data:  { previous, current, unitsUsed, amount, notes: notes?.trim() || null },
  });

  await createNotification(
    t.userId,
    "meter_reading_updated",
    `${t.name} updated meter reading`,
    `${t.name} updated their electricity reading for ${monthLabel(reading.month)}.`,
    { tenantId: t.id, readingId: id, month: reading.month },
  ).catch(() => null);

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const t      = tenant!;
  const { id } = await params;

  const reading = await prisma.meterReading.findUnique({ where: { id } });
  if (!reading || reading.tenantId !== t.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (reading.status !== "pending_review") {
    return NextResponse.json({ error: "Cannot delete a confirmed reading" }, { status: 403 });
  }

  await prisma.meterReading.delete({ where: { id } });

  await createNotification(
    t.userId,
    "meter_reading_deleted",
    `${t.name} deleted meter reading`,
    `${t.name} deleted their electricity reading for ${monthLabel(reading.month)}.`,
    { tenantId: t.id, readingId: id, month: reading.month },
  ).catch(() => null);

  return NextResponse.json({ ok: true });
}
