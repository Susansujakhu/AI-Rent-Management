import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Owner resolves a tenant's payment claim: confirm (verified + recorded) or
// reject (didn't receive / invalid). This only changes the claim's status —
// it never touches the actual payment ledger, which the owner manages
// through the normal record-payment flow.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body   = await req.json().catch(() => ({})) as { action?: string };
  const action = body.action;
  if (action !== "confirm" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'confirm' or 'reject'" }, { status: 400 });
  }

  // Ownership enforced in the WHERE clause.
  const claim = await prisma.paymentClaim.findFirst({
    where:  { id, userId: auth.id },
    select: { id: true, status: true },
  });
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.paymentClaim.update({
    where: { id },
    data:  { status: action === "confirm" ? "confirmed" : "rejected", reviewedAt: new Date() },
  });

  return NextResponse.json(updated);
}
