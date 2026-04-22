import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { sendWhatsAppMessage, getWAStatus } from "@/lib/whatsapp";
import { isPro, planLimitResponse } from "@/lib/plan";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;

  if (!isPro(auth)) return planLimitResponse("Tenant portal requires a Pro plan.");

  if (getWAStatus(userId) !== "ready") {
    return NextResponse.json({ error: "WhatsApp not connected" }, { status: 503 });
  }

  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { id, userId } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!tenant.portalEnabled || !tenant.portalToken) {
    return NextResponse.json({ error: "Portal access is not enabled for this tenant" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link    = `${baseUrl}/portal/t/${tenant.portalToken}`;

  const msg = `Hi ${tenant.name}, here's your personal tenant portal link to view your rent and payment details:\n\n${link}\n\nBookmark this page for future access. The link is personal — please don't share it with others.`;

  const sent = await sendWhatsAppMessage(userId, tenant.phone, msg);
  if (!sent) return NextResponse.json({ error: "Failed to send message" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
