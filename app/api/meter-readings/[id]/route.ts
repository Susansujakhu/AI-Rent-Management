import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json() as { status?: string; createCharge?: boolean };

  const reading = await prisma.meterReading.findFirst({
    where: { id, userId: auth.id },
    include: { tenant: { select: { id: true, name: true, room: { select: { name: true } } } } },
  });
  if (!reading) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.status === "confirmed" && reading.status === "pending_review") {
    let chargeId = reading.chargeId;

    if (body.createCharge !== false && reading.amount > 0 && !chargeId) {
      const [y, m] = reading.month.split("-").map(Number);
      const charge = await prisma.oneTimeCharge.create({
        data: {
          userId:   auth.id,
          tenantId: reading.tenantId,
          title:    `Electricity — ${new Date(y, m - 1).toLocaleDateString("en", { month: "long", year: "numeric" })}`,
          amount:   reading.amount,
          // Use today (when the owner confirmed) rather than the 1st of the
          // reading month, so the charge folds into the current rent period.
          date:     new Date(),
          notes:    `${reading.unitsUsed} units × ${reading.ratePerUnit}/unit`,
        },
      });
      chargeId = charge.id;
    }

    const updated = await prisma.meterReading.update({
      where: { id },
      data:  { status: "confirmed", chargeId },
      include: { tenant: { select: { id: true, name: true, room: { select: { name: true } } } } },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const reading = await prisma.meterReading.findFirst({
    where: { id, userId: auth.id },
  });
  if (!reading) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chargeId = reading.chargeId;
  await prisma.meterReading.delete({ where: { id } });
  if (chargeId) await prisma.oneTimeCharge.delete({ where: { id: chargeId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
