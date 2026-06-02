import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { recomputeBills } from "@/lib/recompute-bills";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id: tenantId } = await params;
  const { title, amount, effectiveFrom } = await req.json();

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (effectiveFrom && !/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveFrom)) {
    return NextResponse.json({ error: "effectiveFrom must be in YYYY-MM format" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId, userId }, select: { roomId: true } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!tenant.roomId) {
    return NextResponse.json({ error: "Tenant has no room assigned" }, { status: 400 });
  }

  const charge = await prisma.recurringCharge.create({
    data: {
      userId,
      roomId: tenant.roomId,
      tenantId,
      title: title.trim(),
      amount: parsedAmount,
      effectiveFrom: effectiveFrom || null,
    },
  });

  // Reconcile every non-PAID bill for this tenant through the shared recompute
  // (one code path for add / stop / delete / admin button). Each bill only
  // picks up the charge if its month is inside the charge's effective window,
  // so bills before effectiveFrom are left unchanged. PAID bills stay locked.
  await recomputeBills(prisma, { userId, tenantId });

  return NextResponse.json(charge);
}
