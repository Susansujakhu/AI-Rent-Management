import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { randomBytes } from "crypto";
import { isPro, planLimitResponse } from "@/lib/plan";
import { sendWhatsAppMessage, getWAStatus } from "@/lib/whatsapp";

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

  await prisma.$executeRaw`
    UPDATE \`Tenant\`
    SET portalEnabled = 1, portalToken = ${portalToken}
    WHERE id = ${id} AND userId = ${userId}
  `;

  return NextResponse.json({ portalToken, portalEnabled: true });
}

/** DELETE — disable portal + revoke all active sessions */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where:  { id, userId },
    select: { id: true, name: true, phone: true },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete sessions and revoke portal access via raw SQL (new tables may not be in deployed Prisma client)
  await prisma.$executeRaw`DELETE FROM \`TenantSession\` WHERE tenantId = ${id}`;
  await prisma.$executeRaw`
    UPDATE \`Tenant\`
    SET portalEnabled = 0, portalToken = NULL
    WHERE id = ${id} AND userId = ${userId}
  `;

  if (tenant.phone && getWAStatus(userId) === "ready") {
    sendWhatsAppMessage(
      userId,
      tenant.phone,
      `Hi ${tenant.name}, your tenant portal access has been disabled. Please contact your property owner if you need access restored.`
    ).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
