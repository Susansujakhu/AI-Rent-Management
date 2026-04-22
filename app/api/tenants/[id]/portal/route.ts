import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { randomBytes } from "crypto";
import { isPro, planLimitResponse } from "@/lib/plan";

type Params = { params: Promise<{ id: string }> };

/** POST — enable portal + (re)generate token */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;

  if (!isPro(auth)) return planLimitResponse("Tenant portal requires a Pro plan.");

  const tenant = await prisma.tenant.findUnique({ where: { id, userId } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const portalToken = randomBytes(32).toString("hex");

  const updated = await prisma.tenant.update({
    where: { id, userId },
    data:  { portalEnabled: true, portalToken },
  });

  return NextResponse.json({ portalToken: updated.portalToken, portalEnabled: true });
}

/** DELETE — disable portal + revoke all active sessions */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;

  // Verify ownership before modifying
  const tenant = await prisma.tenant.findUnique({ where: { id, userId }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.tenantSession.deleteMany({ where: { tenantId: id } });
  await prisma.tenant.update({
    where: { id, userId },
    data:  { portalEnabled: false, portalToken: null },
  });

  return NextResponse.json({ ok: true });
}
