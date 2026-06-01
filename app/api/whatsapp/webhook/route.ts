import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "";

// Meta's webhook handshake: GET with hub.mode=subscribe + hub.verify_token, echo
// back hub.challenge if the token matches.
export async function GET(req: Request) {
  const url       = new URL(req.url);
  const mode      = url.searchParams.get("hub.mode");
  const token     = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

// Tenants are looked up by the last 10 digits of their phone — robust against
// stored variants like "+9779812345678", "9812345678", "977-98-1234-5678".
function lastDigits(phone: string, n = 10): string {
  return phone.replace(/\D/g, "").slice(-n);
}

// Meta posts the messages array on `entry[].changes[].value.messages` for new
// inbound messages, and `value.statuses` for delivery status updates. We only
// care about text messages for now (skip media until we add storage).
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  console.error("[wa:webhook] POST received");
  const payload = body as {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: {
          metadata?:  { phone_number_id?: string; display_phone_number?: string };
          messages?:  Array<{ id: string; from: string; type: string; text?: { body?: string } }>;
          statuses?:  Array<{ id: string; status: string }>;
        };
      }>;
    }>;
  };
  if (payload?.object !== "whatsapp_business_account") {
    console.error("[wa:webhook] dropping: object =", payload?.object);
    return NextResponse.json({ ok: true });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value   = change.value;
      const display = value?.metadata?.display_phone_number ?? "";
      if (!display) {
        console.error("[wa:webhook] dropping: no display_phone_number in metadata");
        continue;
      }

      // Owner lookup: prefer the `wa_owner_user_id` GlobalSetting if set; else
      // fall back to matching the business number against User.phone.
      const ownerDigits = lastDigits(display, 10);
      const ownerSetting = await prisma.globalSetting.findUnique({ where: { key: "wa_owner_user_id" } });
      let owner: { id: string } | null = null;
      if (ownerSetting?.value) {
        owner = await prisma.user.findUnique({ where: { id: ownerSetting.value }, select: { id: true } });
        if (!owner) console.error("[wa:webhook] wa_owner_user_id setting points to unknown user:", ownerSetting.value);
      }
      if (!owner) {
        owner = await prisma.user.findFirst({
          where: { phone: { contains: ownerDigits } },
          select: { id: true },
        });
      }
      if (!owner) {
        console.error("[wa:webhook] dropping: no owner matched (display=", display, "ownerDigits=", ownerDigits, ")");
        continue;
      }
      console.error("[wa:webhook] routing to owner", owner.id, "from", display);

      // ── Status updates (delivered / read / failed) — update outbound rows ──
      for (const s of value?.statuses ?? []) {
        await prisma.whatsAppMessage.updateMany({
          where: { metaMessageId: s.id, direction: "out" },
          data:  { status: s.status },
        }).catch(() => null);
      }

      // ── New incoming messages ─────────────────────────────────────────────
      for (const m of value?.messages ?? []) {
        if (m.type !== "text") { console.error("[wa:webhook] skipping non-text message type:", m.type); continue; }
        const text = m.text?.body?.trim();
        if (!text) { console.error("[wa:webhook] skipping: empty text"); continue; }

        // Dedup: Meta retries the same webhook on errors.
        const existing = await prisma.whatsAppMessage.findUnique({ where: { metaMessageId: m.id } });
        if (existing) { console.error("[wa:webhook] dedup hit for wamid:", m.id); continue; }

        const fromE164 = `+${m.from}`;
        const tenant   = await prisma.tenant.findFirst({
          where:  { userId: owner.id, phone: { contains: lastDigits(m.from, 10) } },
          select: { id: true, name: true },
        });
        console.error("[wa:webhook] saving message from", fromE164, "tenant=", tenant?.id ?? "(unknown)");

        await prisma.whatsAppMessage.create({
          data: {
            userId:        owner.id,
            tenantId:      tenant?.id ?? null,
            direction:     "in",
            phone:         fromE164,
            body:          text,
            metaMessageId: m.id,
            readByOwner:   false,
          },
        });

        // Bell + (optionally) owner WhatsApp echo. The mirror-to-WhatsApp would
        // create a loop here, so disable it for inbox events.
        await createNotification(
          owner.id,
          "whatsapp_message",
          tenant ? `${tenant.name} replied on WhatsApp` : `New WhatsApp message from ${fromE164}`,
          text.length > 80 ? text.slice(0, 80) + "…" : text,
          { tenantId: tenant?.id, phone: fromE164 },
          { whatsapp: false },
        ).catch(() => null);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
