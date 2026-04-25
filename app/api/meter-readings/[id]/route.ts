import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

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
