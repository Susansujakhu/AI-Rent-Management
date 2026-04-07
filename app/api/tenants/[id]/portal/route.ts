import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { randomBytes } from "crypto";

type Params = { params: Promise<{ id: string }> };

/** POST — enable portal + (re)generate token */
export async function POST(req: Request, { params }: Params) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const portalToken = randomBytes(32).toString("hex");

  const updated = await prisma.tenant.update({
    where: { id },
    data:  { portalEnabled: true, portalToken },
  });

  return NextResponse.json({ portalToken: updated.portalToken, portalEnabled: true });
}

/** DELETE — disable portal + revoke all active sessions */
export async function DELETE(req: Request, { params }: Params) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;

  await prisma.tenantSession.deleteMany({ where: { tenantId: id } });
  await prisma.tenant.update({
    where: { id },
    data:  { portalEnabled: false, portalToken: null },
  });

  return NextResponse.json({ ok: true });
}
