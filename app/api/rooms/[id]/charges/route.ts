import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { recomputeBills } from "@/lib/recompute-bills";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
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
  // Verify the room belongs to this user before creating a charge for it
  const room = await prisma.room.findUnique({
    where:   { id, userId },
    include: { recurringCharges: true, rentHistory: true },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const charge = await prisma.recurringCharge.create({
    data: {
      userId,
      roomId: id,
      title: title.trim(),
      amount: parsedAmount,
      effectiveFrom: effectiveFrom || null,
    },
  });

  // Reconcile every non-PAID bill in this room through the shared recompute
  // (one code path for add / stop / delete / admin button). Room-level charges
  // apply to all tenants; each bill only picks up the charge if its month is
  // inside the effective window, so earlier bills stay unchanged. PAID locked.
  await recomputeBills(prisma, { userId, roomId: id });

  return NextResponse.json(charge);
}
