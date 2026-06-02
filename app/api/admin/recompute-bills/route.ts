import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { recomputeBills } from "@/lib/recompute-bills";

// POST /api/admin/recompute-bills
// Body: { userId? }  -- if absent, walks every user.
//
// Recomputes amountDue + status on every non-PAID Payment. PAID bills are
// never touched. Returns counts so the admin sees what changed.
export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { userId?: string };
  const scope = body.userId ? { userId: body.userId } : {};

  const result = await recomputeBills(prisma, scope);
  return NextResponse.json({ ok: true, ...result, scope });
}
