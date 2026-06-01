import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month    = searchParams.get("month");
  const tenantId = searchParams.get("tenantId");
  const latest   = searchParams.get("latest") === "1";

  const readings = await prisma.meterReading.findMany({
    where: {
      userId: auth.id,
      ...(month    ? { month }    : {}),
      ...(tenantId ? { tenantId } : {}),
    },
    include: {
      tenant: { select: { id: true, name: true, room: { select: { name: true } } } },
    },
    orderBy: [{ month: "desc" }, { tenant: { name: "asc" } }],
  });

  if (latest) {
    const seen = new Set<string>();
    return NextResponse.json(readings.filter(r => {
      if (seen.has(r.tenantId)) return false;
      seen.add(r.tenantId);
      return true;
    }));
  }

  return NextResponse.json(readings);
}

export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;

  const body = await req.json() as {
    tenantId:    string;
    month:       string;
    previous:    number;
    current:     number;
    ratePerUnit: number;
    notes?:      string;
    createCharge?: boolean;
    readingDate?: string | null;
  };

  const { tenantId, month, previous, current, ratePerUnit, notes, createCharge, readingDate } = body;

  if (!tenantId || !month || !(/^\d{4}-\d{2}$/.test(month))) {
    return NextResponse.json({ error: "tenantId and month (YYYY-MM) are required" }, { status: 400 });
  }
  if (typeof previous !== "number" || typeof current !== "number" || typeof ratePerUnit !== "number") {
    return NextResponse.json({ error: "previous, current, and ratePerUnit must be numbers" }, { status: 400 });
  }
  if (current < previous) {
    return NextResponse.json({ error: "Current reading cannot be less than previous reading" }, { status: 400 });
  }
  if (ratePerUnit <= 0) {
    return NextResponse.json({ error: "Rate per unit must be positive" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, userId } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const unitsUsed = parseFloat((current - previous).toFixed(2));
  const amount    = parseFloat((unitsUsed * ratePerUnit).toFixed(2));

  const existing = await prisma.meterReading.findUnique({
    where: { tenantId_month: { tenantId, month } },
  });
  if (existing) {
    return NextResponse.json({ error: "A reading already exists for this tenant and month" }, { status: 409 });
  }

  let chargeId: string | null = null;

  if (createCharge && amount > 0) {
    const [y, m] = month.split("-").map(Number);
    // Prefer the user-supplied reading date; fall back to today, then to
    // the 1st of the reading month if neither is usable.
    const parsedDate = readingDate ? new Date(readingDate) : null;
    const chargeDate = parsedDate && !isNaN(parsedDate.getTime())
      ? parsedDate
      : new Date();
    const charge = await prisma.oneTimeCharge.create({
      data: {
        userId,
        tenantId,
        title:  `Electricity — ${new Date(y, m - 1).toLocaleDateString("en", { month: "long", year: "numeric" })}`,
        amount,
        date:   chargeDate,
        notes:  `${unitsUsed} units × ${ratePerUnit}/unit`,
      },
    });
    chargeId = charge.id;
  }

  const reading = await prisma.meterReading.create({
    data: { userId, tenantId, month, previous, current, ratePerUnit, unitsUsed, amount, chargeId, notes: notes?.trim() || null },
    include: {
      tenant: { select: { id: true, name: true, room: { select: { name: true } } } },
    },
  });

  return NextResponse.json(reading, { status: 201 });
}
