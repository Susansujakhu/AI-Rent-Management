import { NextResponse } from "next/server";
import { requireTenantAPIByToken } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function GET(req: Request) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const t = tenant!;

  if (!t.canSubmitMeterReading) {
    return NextResponse.json({ error: "Not enabled" }, { status: 403 });
  }

  const readings = await prisma.meterReading.findMany({
    where:   { tenantId: t.id },
    orderBy: { month: "desc" },
  });

  return NextResponse.json(readings);
}

export async function POST(req: Request) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const t = tenant!;

  if (!t.canSubmitMeterReading) {
    return NextResponse.json({ error: "Not enabled" }, { status: 403 });
  }

  const body = await req.json() as {
    month:    string;
    previous: number;
    current:  number;
    notes?:   string;
  };

  const { month, previous, current, notes } = body;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month (YYYY-MM) is required" }, { status: 400 });
  }
  if (typeof previous !== "number" || typeof current !== "number") {
    return NextResponse.json({ error: "previous and current must be numbers" }, { status: 400 });
  }
  if (current < previous) {
    return NextResponse.json({ error: "Current reading cannot be less than previous reading" }, { status: 400 });
  }

  const existing = await prisma.meterReading.findUnique({
    where: { tenantId_month: { tenantId: t.id, month } },
  });
  if (existing) {
    return NextResponse.json({ error: "A reading already exists for this month" }, { status: 409 });
  }

  // Get owner's electricity rate from settings
  const rateSetting = await prisma.setting.findUnique({
    where: { userId_key: { userId: t.userId, key: "electricityRate" } },
  });
  const ratePerUnit = parseFloat(rateSetting?.value ?? "0");
  const unitsUsed   = parseFloat((current - previous).toFixed(2));
  const amount      = parseFloat((unitsUsed * ratePerUnit).toFixed(2));

  const autoAccept = t.meterReadingAutoAccept;
  let chargeId: string | null = null;

  if (autoAccept && amount > 0) {
    const [y, m] = month.split("-").map(Number);
    const charge = await prisma.oneTimeCharge.create({
      data: {
        userId:   t.userId,
        tenantId: t.id,
        title:    `Electricity — ${new Date(y, m - 1).toLocaleDateString("en", { month: "long", year: "numeric" })}`,
        amount,
        date:     new Date(y, m - 1, 1),
        notes:    `${unitsUsed} units × ${ratePerUnit}/unit`,
      },
    });
    chargeId = charge.id;
  }

  const reading = await prisma.meterReading.create({
    data: {
      userId:            t.userId,
      tenantId:          t.id,
      month,
      previous,
      current,
      ratePerUnit,
      unitsUsed,
      amount,
      chargeId,
      notes:             notes?.trim() || null,
      submittedByTenant: true,
      status:            autoAccept ? "confirmed" : "pending_review",
    },
  });

  const [y, m2] = month.split("-").map(Number);
  const label   = new Date(y, m2 - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
  await createNotification(
    t.userId,
    "meter_reading_submitted",
    `${t.name} submitted meter reading`,
    autoAccept
      ? `${t.name} submitted electricity reading for ${label} (auto-confirmed).`
      : `${t.name} submitted electricity reading for ${label}. Review required.`,
    { tenantId: t.id, readingId: reading.id, month },
  ).catch(() => null);

  return NextResponse.json(reading, { status: 201 });
}
