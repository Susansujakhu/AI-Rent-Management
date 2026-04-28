import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { isPro, planLimitResponse } from "@/lib/plan";

type Params = { params: Promise<{ id: string }> };

type TenantRow = { id: string; name: string; phone: string; portalEnabled: number | boolean; portalToken: string | null };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthAPI();
    if (auth instanceof NextResponse) return auth;
    const userId = auth.id;

    if (!isPro(auth)) return planLimitResponse("Tenant portal requires a Pro plan.");

    const { id } = await params;

    const rows = await prisma.$queryRaw<TenantRow[]>`
      SELECT id, name, phone, portalEnabled, portalToken
      FROM \`Tenant\`
      WHERE id = ${id} AND userId = ${userId}
      LIMIT 1
    `;
    const tenant = rows[0];
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const enabled = tenant.portalEnabled === 1 || tenant.portalEnabled === true;
    if (!enabled || !tenant.portalToken) {
      return NextResponse.json({ error: "Portal access is not enabled for this tenant" }, { status: 400 });
    }

    const { sendWhatsAppMessage, getWAStatus } = await import("@/lib/whatsapp");

    if (getWAStatus(userId) !== "ready") {
      return NextResponse.json({ error: "WhatsApp not connected" }, { status: 503 });
    }

    const proto   = req.headers.get("x-forwarded-proto") ?? "https";
    const host    = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
    const baseUrl = `${proto}://${host}`;
    const link    = `${baseUrl}/portal/t/${tenant.portalToken}`;

    const msg = `Hi ${tenant.name}, here's your personal tenant portal link to view your rent and payment details:\n\n${link}\n\nBookmark this page for future access. The link is personal — please don't share it with others.`;

    const sent = await sendWhatsAppMessage(userId, tenant.phone, msg);
    if (!sent) return NextResponse.json({ error: "Failed to send message" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[send-link POST]", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
