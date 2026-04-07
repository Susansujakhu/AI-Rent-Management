import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
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
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name  !== undefined) data.name  = body.name;
  if (body.phone !== undefined) data.phone = body.phone;
  if ("email"   in body) data.email  = body.email  || null;
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
  if ("notes"          in body) data.notes          = body.notes || null;
  if ("whatsappNotify" in body) data.whatsappNotify = Boolean(body.whatsappNotify);

  // ── Move-out handling ────────────────────────────────────────────────────────
  if ("moveOutDate" in body && !body.moveOutDate) {
    // Clearing move-out date (re-activating tenant)
    data.moveOutDate = null;
  } else if ("moveOutDate" in body && body.moveOutDate) {
    const moveOutDate = new Date(body.moveOutDate);
    if (isNaN(moveOutDate.getTime())) return NextResponse.json({ error: "moveOutDate must be a valid date" }, { status: 400 });
    data.moveOutDate  = moveOutDate;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { room: { include: { recurringCharges: true } } },
    });

    if (tenant?.room && tenant.roomId) {
      const baseAmount  = tenant.room.monthlyRent
        + tenant.room.recurringCharges.reduce((s, c) => s + c.amount, 0);
      const moYear      = moveOutDate.getFullYear();
      const moMonthNum  = moveOutDate.getMonth() + 1;
      const moMonthStr  = monthStr(moYear, moMonthNum);
      const daysInMonth = new Date(moYear, moMonthNum, 0).getDate();
      const daysOccupied = moveOutDate.getDate();

      // 1. Pro-rate the move-out month (only if not already paid)
      const proRated = Math.round((daysOccupied / daysInMonth) * baseAmount);
      await prisma.payment.updateMany({
        where: { tenantId: id, month: moMonthStr, amountPaid: 0 },
        data:  { amountDue: proRated },
      });

      // 2. Delete future PENDING months that were pre-generated (after move-out month)
      await prisma.payment.deleteMany({
        where: {
          tenantId: id,
          month:    { gt: moMonthStr },
          status:   "PENDING",
          amountPaid: 0,
        },
      });

      // 3. Apply deposit to outstanding balance (oldest-first)
      if (tenant.deposit > 0) {
        const outstanding = await prisma.payment.findMany({
          where:   { tenantId: id, status: { not: "PAID" } },
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

  const tenant = await prisma.tenant.update({ where: { id }, data });
  return NextResponse.json(tenant);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  await prisma.tenant.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
