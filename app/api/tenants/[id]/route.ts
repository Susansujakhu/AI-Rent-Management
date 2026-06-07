import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { generatePaymentsFromMoveIn } from "@/lib/generate-payments";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id, userId },
    include: { room: true, payments: { orderBy: { month: "desc" } } },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tenant);
}

function monthStr(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function resolveStatus(paid: number, due: number, wasOverdue: boolean): string {
  if (paid >= due) return "PAID";
  if (paid > 0)   return "PARTIAL";
  return wasOverdue ? "OVERDUE" : "PENDING";
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (typeof body.name === "string" && body.name.length > 255)
      return NextResponse.json({ error: "name must be 255 characters or fewer" }, { status: 400 });
    data.name = body.name;
  }
  if (body.phone !== undefined) {
    if (typeof body.phone === "string" && body.phone.length > 20)
      return NextResponse.json({ error: "phone must be 20 characters or fewer" }, { status: 400 });
    data.phone = body.phone;
  }
  if ("email" in body) {
    if (typeof body.email !== "string" || !body.email.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    data.email = body.email.trim();
  }
  if ("roomId"  in body) data.roomId = body.roomId || null;
  if (body.moveInDate !== undefined) {
    const d = new Date(body.moveInDate);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "moveInDate must be a valid date" }, { status: 400 });
    data.moveInDate = d;
  }
  if (body.deposit !== undefined) {
    const dep = Number(body.deposit);
    if (!Number.isFinite(dep) || dep < 0) return NextResponse.json({ error: "deposit must be a non-negative number" }, { status: 400 });
    data.deposit = dep;
  }
  if ("notes" in body) {
    if (body.notes && typeof body.notes === "string" && body.notes.length > 5000)
      return NextResponse.json({ error: "notes must be 5000 characters or fewer" }, { status: 400 });
    data.notes = body.notes || null;
  }
  if ("whatsappNotify"         in body) data.whatsappNotify         = Boolean(body.whatsappNotify);
  if ("meterReadingAutoAccept" in body) data.meterReadingAutoAccept = Boolean(body.meterReadingAutoAccept);

  if ("electricityRate" in body) {
    if (body.electricityRate === null || body.electricityRate === "") {
      data.electricityRate = null;
    } else {
      const r = Number(body.electricityRate);
      if (!Number.isFinite(r) || r < 0)
        return NextResponse.json({ error: "electricityRate must be a non-negative number" }, { status: 400 });
      data.electricityRate = r > 0 ? r : null;   // 0 means "no override"
    }
  }

  if ("canSubmitMeterReading" in body) {
    data.canSubmitMeterReading = Boolean(body.canSubmitMeterReading);
    if (data.canSubmitMeterReading) {
      // A meter reading is worthless without a rate — require an effective rate
      // (per-tenant override, set in this same request or already stored, else
      // the global default) before tenants can submit readings.
      const tenantRate = "electricityRate" in data
        ? (data.electricityRate as number | null)
        : (await prisma.tenant.findFirst({ where: { id, userId }, select: { electricityRate: true } }))?.electricityRate ?? null;
      let eff = tenantRate ?? 0;
      if (eff <= 0) {
        const g = await prisma.setting.findUnique({ where: { userId_key: { userId, key: "electricityRate" } } });
        eff = parseFloat(g?.value ?? "0") || 0;
      }
      if (eff <= 0)
        return NextResponse.json({ error: "Add an electricity unit rate first, then enable meter readings." }, { status: 400 });
    }
  }

  // ── Move-out handling ────────────────────────────────────────────────────────
  if ("moveOutDate" in body && !body.moveOutDate) {
    // Clearing move-out date (re-activating tenant). If a settlement was
    // recorded, it must be voided first so the financial records reverse too.
    const settled = await prisma.settlement.findFirst({ where: { tenantId: id, userId }, select: { id: true } });
    if (settled)
      return NextResponse.json(
        { error: "A move-out settlement exists for this tenant. Void the settlement to re-activate." },
        { status: 400 },
      );
    data.moveOutDate = null;
  } else if ("moveOutDate" in body && body.moveOutDate) {
    const moveOutDate = new Date(body.moveOutDate);
    if (isNaN(moveOutDate.getTime())) return NextResponse.json({ error: "moveOutDate must be a valid date" }, { status: 400 });
    data.moveOutDate  = moveOutDate;

    const tenant = await prisma.tenant.findUnique({
      where: { id, userId },
      include: { room: { include: { recurringCharges: true } } },
    });

    if (tenant?.room && tenant.roomId) {
      const moYear      = moveOutDate.getFullYear();
      const moMonthNum  = moveOutDate.getMonth() + 1;
      const moMonthStr  = monthStr(moYear, moMonthNum);
      const baseAmount  = tenant.room.monthlyRent
        + tenant.room.recurringCharges
            .filter(c => (c.tenantId === null || c.tenantId === id)
              && (!c.effectiveFrom || c.effectiveFrom <= moMonthStr)
              && (!c.effectiveTo   || moMonthStr <= c.effectiveTo))
            .reduce((s, c) => s + c.amount, 0);
      const daysInMonth = new Date(moYear, moMonthNum, 0).getDate();
      const daysOccupied = moveOutDate.getDate();

      // 1. Pro-rate the move-out month (only if not already paid)
      const proRated = Math.round((daysOccupied / daysInMonth) * baseAmount);
      await prisma.payment.updateMany({
        where: { tenantId: id, userId, month: moMonthStr, amountPaid: 0 },
        data:  { amountDue: proRated },
      });

      // 2. Delete future PENDING months that were pre-generated (after move-out month)
      await prisma.payment.deleteMany({
        where: {
          tenantId: id,
          userId,
          month:    { gt: moMonthStr },
          status:   "PENDING",
          amountPaid: 0,
        },
      });

      // 3. Apply deposit to outstanding balance (oldest-first)
      if (tenant.deposit > 0) {
        const outstanding = await prisma.payment.findMany({
          where:   { tenantId: id, userId, status: { not: "PAID" } },
          orderBy: { month: "asc" },
        });

        let depositLeft = tenant.deposit;
        for (const p of outstanding) {
          if (depositLeft <= 0) break;
          const balance = p.amountDue - p.amountPaid;
          if (balance <= 0) continue;
          const apply   = Math.min(depositLeft, balance);
          depositLeft  -= apply;
          const newPaid = p.amountPaid + apply;
          await prisma.payment.update({
            where: { id: p.id },
            data:  {
              amountPaid: newPaid,
              status:     resolveStatus(newPaid, p.amountDue, p.status === "OVERDUE"),
              method:     "DEPOSIT",
              paidDate:   moveOutDate,
              notes:      "Security deposit applied at move-out",
            },
          });
        }
      }
    }
  }

  const before = await prisma.tenant.findUnique({ where: { id, userId }, select: { roomId: true, moveInDate: true } });

  // Build raw SQL update so new fields (canSubmitMeterReading, meterReadingAutoAccept, etc.)
  // work even when the server's Prisma client predates those columns.
  const fieldSql: Record<string, (v: unknown) => Prisma.Sql> = {
    name:                 v => Prisma.sql`\`name\` = ${v as string}`,
    phone:                v => Prisma.sql`\`phone\` = ${v as string | null}`,
    email:                v => Prisma.sql`\`email\` = ${v as string | null}`,
    roomId:               v => Prisma.sql`\`roomId\` = ${v as string | null}`,
    moveInDate:           v => Prisma.sql`\`moveInDate\` = ${v as Date}`,
    moveOutDate:          v => Prisma.sql`\`moveOutDate\` = ${v as Date | null}`,
    deposit:              v => Prisma.sql`\`deposit\` = ${v as number}`,
    notes:                v => Prisma.sql`\`notes\` = ${v as string | null}`,
    whatsappNotify:           v => Prisma.sql`\`whatsappNotify\` = ${v ? 1 : 0}`,
    canSubmitMeterReading:    v => Prisma.sql`\`canSubmitMeterReading\` = ${v ? 1 : 0}`,
    meterReadingAutoAccept:   v => Prisma.sql`\`meterReadingAutoAccept\` = ${v ? 1 : 0}`,
    electricityRate:          v => Prisma.sql`\`electricityRate\` = ${v as number | null}`,
  };
  const setParts = Object.entries(data)
    .filter(([k]) => fieldSql[k])
    .map(([k, v]) => fieldSql[k](v));

  if (setParts.length > 0) {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE \`Tenant\` SET ${Prisma.join(setParts)} WHERE id = ${id} AND userId = ${userId}`
    );
  }

  const tenant = await prisma.tenant.findUnique({ where: { id, userId } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Regenerate payments if room was just assigned or moveInDate changed
  const roomChanged     = "roomId" in data && data.roomId && data.roomId !== before?.roomId;
  const moveInChanged   = "moveInDate" in data;
  const effectiveRoomId = tenant.roomId;
  if ((roomChanged || moveInChanged) && effectiveRoomId && tenant.moveInDate) {
    generatePaymentsFromMoveIn(userId, id, effectiveRoomId, tenant.moveInDate)
      .catch(err => console.error("[tenant update] Payment generation failed:", err));
  }

  return NextResponse.json(tenant);
  } catch (e: any) {
    console.error("[tenant PUT]", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
  await prisma.tenant.delete({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
