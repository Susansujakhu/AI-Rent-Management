const WA_GRAPH_URL = "https://graph.facebook.com/v20.0";

// ── Mode cache (60 s TTL) ─────────────────────────────────────────────────────
interface WAModeCache { mode: "api" | "direct"; expiresAt: number }
const gm = globalThis as typeof globalThis & { _waModeCache: WAModeCache | undefined };

export async function getWAMode(): Promise<"api" | "direct"> {
  const now = Date.now();
  if (gm._waModeCache && now < gm._waModeCache.expiresAt) return gm._waModeCache.mode;
  try {
    const { prisma } = await import("./prisma");
    const row = await prisma.globalSetting.findUnique({ where: { key: "wa_mode" } });
    const mode: "api" | "direct" = row?.value === "direct" ? "direct" : "api";
    gm._waModeCache = { mode, expiresAt: now + 60_000 };
    return mode;
  } catch {
    return "api";
  }
}

export function invalidateWAModeCache() {
  gm._waModeCache = undefined;
}

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

export async function isWhatsAppReady(): Promise<boolean> {
  const mode = await getWAMode();
  if (mode === "direct") {
    const { getDirectWASession } = await import("./whatsapp-direct");
    return getDirectWASession().status === "ready";
  }
  return isWhatsAppConfigured();
}

function formatWhatsAppPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && (digits.startsWith("98") || digits.startsWith("97"))) {
    digits = "977" + digits;
  }
  return digits;
}

async function sendViaAPI(phone: string, message: string): Promise<boolean> {
  if (!isWhatsAppConfigured()) {
    console.warn("[whatsapp] Not configured — WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN missing");
    return false;
  }

  const to  = formatWhatsAppPhone(phone);
  const url = `${WA_GRAPH_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message, preview_url: false },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[whatsapp] Send failed:", JSON.stringify(err));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] Network error:", err);
    return false;
  }
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string,
  opts?: { skipEmailMirror?: boolean },
): Promise<boolean> {
  const mode = await getWAMode();
  let ok: boolean;
  if (mode === "direct") {
    const { sendDirectMessage } = await import("./whatsapp-direct");
    ok = await sendDirectMessage(phone, message);
  } else {
    ok = await sendViaAPI(phone, message);
  }
  // Mirror to email (best-effort, fire-and-forget). Doesn't gate the WA result.
  // OTP paths pass skipEmailMirror because they send their own formatted email.
  if (!opts?.skipEmailMirror) void emailMirror(phone, message).catch(() => null);
  return ok;
}

// Look up the tenant or user this phone belongs to and email them the same
// content as an HTML message. Skips silently when there's no email on file.
async function emailMirror(phone: string, message: string): Promise<void> {
  const digits = phone.replace(/\D/g, "").slice(-9);
  if (!digits) return;
  const { prisma } = await import("./prisma");
  const tenant = await prisma.tenant.findFirst({
    where:  { phone: { contains: digits }, email: { not: null } },
    select: { email: true },
  });
  let to = tenant?.email ?? null;
  if (!to) {
    const user = await prisma.user.findFirst({
      where:  { phone: { contains: digits }, email: { not: null } },
      select: { email: true },
    });
    to = user?.email ?? null;
  }
  if (!to) return;
  const { sendEmail, whatsappToHtml } = await import("./email");
  // Subject from the first line (without WhatsApp formatting marks).
  const firstLine = message.split("\n")[0].replace(/[*_]/g, "").trim();
  const subject   = firstLine ? `EasyRent: ${firstLine.slice(0, 90)}` : "EasyRent notification";
  await sendEmail(to, subject, whatsappToHtml(message), message);
}

// ── Message templates ─────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES = {
  paymentReceived: "Hi {name}! ✅\n\nYour payment of *{amount}* for *{room}* ({month}) has been received.\n\nThank you! 🙏\n\n📄 Receipt: {receipt}",
  rentDue:         "Hi {name}! 📋\n\nYour rent of *{amount}* for *{room}* is due for *{month}*.\n\nPlease pay on time. Thank you!",
  rentOverdue:     "Hi {name}! ⚠️\n\nYour rent of *{amount}* for *{room}* ({month}) is *overdue*.\n\nPlease contact us to settle your dues. Thank you.",
};

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES;

function fillTemplate(template: string, vars: { name: string; amount: string; month: string; room: string; receipt?: string }) {
  let result = template
    .replace(/\{name\}/g,   vars.name)
    .replace(/\{amount\}/g, vars.amount)
    .replace(/\{month\}/g,  vars.month)
    .replace(/\{room\}/g,   vars.room);
  if (vars.receipt) {
    result = result.replace(/\{receipt\}/g, vars.receipt);
  } else {
    result = result.split("\n").filter(l => !l.includes("{receipt}")).join("\n").trimEnd();
  }
  return result;
}

export function buildMessage(template: string, vars: { name: string; amount: string; month: string; room: string }) {
  return fillTemplate(template, vars);
}

export function msgPaymentReceived(name: string, amount: string, month: string, room: string, template?: string, receiptUrl?: string, breakdownLines?: string[]) {
  let msg = fillTemplate(template ?? DEFAULT_TEMPLATES.paymentReceived, { name, amount, month, room, receipt: receiptUrl });
  if (breakdownLines?.length) msg += "\n\n*Breakdown:*\n" + breakdownLines.join("\n");
  return msg;
}

export function msgRentDue(name: string, amount: string, month: string, room: string, template?: string) {
  return fillTemplate(template ?? DEFAULT_TEMPLATES.rentDue, { name, amount, month, room });
}

export function msgRentOverdue(name: string, amount: string, month: string, room: string, template?: string) {
  return fillTemplate(template ?? DEFAULT_TEMPLATES.rentOverdue, { name, amount, month, room });
}
