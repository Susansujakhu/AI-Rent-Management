import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { sendWhatsAppMessage, isWhatsAppReady } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";
import { isPro, planLimitResponse } from "@/lib/plan";

export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;

  if (!isPro(auth)) return planLimitResponse("WhatsApp messaging requires a Pro plan.");

  if (!(await isWhatsAppReady())) {
    return NextResponse.json({ error: "WhatsApp not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { tenantId?: string; body?: string };
  const text = body.body?.trim();
  if (!body.tenantId || typeof body.tenantId !== "string") {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }
  if (!text)               return NextResponse.json({ error: "Message body required" }, { status: 400 });
  if (text.length > 4096)  return NextResponse.json({ error: "Message too long (max 4096 chars)" }, { status: 400 });

  const tenant = await prisma.tenant.findFirst({
    where:  { id: body.tenantId, userId },
    select: { id: true, phone: true },
  });
  if (!tenant)       return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (!tenant.phone) return NextResponse.json({ error: "Tenant has no phone number" }, { status: 400 });

  const ok = await sendWhatsAppMessage(tenant.phone, text);
  if (!ok) return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 502 });

  // Store the outbound copy so it shows in the thread immediately.
  await prisma.whatsAppMessage.create({
    data: {
      userId,
      tenantId:    tenant.id,
      direction:   "out",
      phone:       tenant.phone,
      body:        text,
      status:      "sent",
      readByOwner: true, // owner sent it; not unread for themselves
    },
  });

  return NextResponse.json({ ok: true });
}
