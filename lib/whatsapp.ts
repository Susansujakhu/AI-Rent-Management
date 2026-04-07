import { Client, LocalAuth } from "whatsapp-web.js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("qrcode") as { toDataURL: (text: string, opts?: object) => Promise<string> };

type WAStatus = "disconnected" | "connecting" | "qr" | "ready";

interface WAGlobal {
  _waClient:  Client    | undefined;
  _waStatus:  WAStatus;
  _waQR:      string    | null;
  _waQRImage: string    | null;
  _waPhone:   string    | null;
}

const g = globalThis as typeof globalThis & WAGlobal;

// Persist across Next.js hot-reloads
if (g._waStatus === undefined) {
  g._waClient  = undefined;
  g._waStatus  = "disconnected";
  g._waQR      = null;
  g._waQRImage = null;
  g._waPhone   = null;
}

export function getWAStatus()  { return g._waStatus; }
export function getWAQRImage() { return g._waQRImage; }
export function getWAPhone()   { return g._waPhone; }

export async function initWhatsApp() {
  if (g._waClient || g._waStatus === "connecting" || g._waStatus === "ready") return;

  g._waStatus = "connecting";

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  client.on("qr", async (qr) => {
    g._waQR = qr;
    g._waStatus = "qr";
    try {
      g._waQRImage = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
    } catch {
      g._waQRImage = null;
    }
  });

  client.on("authenticated", () => {
    g._waQR      = null;
    g._waQRImage = null;
  });

  client.on("ready", () => {
    g._waStatus  = "ready";
    g._waQR      = null;
    g._waQRImage = null;
    const info   = client.info;
    g._waPhone   = info?.wid?.user ?? null;
  });

  client.on("disconnected", () => {
    g._waStatus  = "disconnected";
    g._waQR      = null;
    g._waQRImage = null;
    g._waPhone   = null;
    g._waClient  = undefined;
  });

  client.on("auth_failure", () => {
    g._waStatus = "disconnected";
    g._waClient = undefined;
  });

  await client.initialize();
  g._waClient = client;
}

export async function disconnectWhatsApp() {
  if (g._waClient) {
    await g._waClient.destroy().catch(() => null);
    g._waClient  = undefined;
    g._waStatus  = "disconnected";
    g._waQR      = null;
    g._waQRImage = null;
    g._waPhone   = null;
  }
}

/** Format a phone number to WhatsApp ID format: <digits>@c.us */
export function formatWhatsAppId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // 10-digit Nepal numbers (98XXXXXXXX / 97XXXXXXXX) — prepend 977
  if (digits.length === 10 && (digits.startsWith("98") || digits.startsWith("97"))) {
    return `977${digits}@c.us`;
  }
  // Already includes country code
  return `${digits}@c.us`;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  if (g._waStatus !== "ready" || !g._waClient) return false;
  try {
    const chatId = formatWhatsAppId(phone);
    await g._waClient.sendMessage(chatId, message);
    return true;
  } catch {
    return false;
  }
}

// ── Message templates ────────────────────────────────────────────────────────
// Placeholders: {name}, {amount}, {month}, {room}

export const DEFAULT_TEMPLATES = {
  paymentReceived: "Hi {name}! ✅\n\nYour payment of *{amount}* for *{room}* ({month}) has been received.\n\nThank you! 🙏",
  rentDue:         "Hi {name}! 📋\n\nYour rent of *{amount}* for *{room}* is due for *{month}*.\n\nPlease pay on time. Thank you!",
  rentOverdue:     "Hi {name}! ⚠️\n\nYour rent of *{amount}* for *{room}* ({month}) is *overdue*.\n\nPlease contact us to settle your dues. Thank you.",
};

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES;

function fillTemplate(template: string, vars: { name: string; amount: string; month: string; room: string }) {
  return template
    .replace(/\{name\}/g,   vars.name)
    .replace(/\{amount\}/g, vars.amount)
    .replace(/\{month\}/g,  vars.month)
    .replace(/\{room\}/g,   vars.room);
}

export function buildMessage(template: string, vars: { name: string; amount: string; month: string; room: string }) {
  return fillTemplate(template, vars);
}

export function msgPaymentReceived(name: string, amount: string, month: string, room: string, template?: string) {
  return fillTemplate(template ?? DEFAULT_TEMPLATES.paymentReceived, { name, amount, month, room });
}

export function msgRentDue(name: string, amount: string, month: string, room: string, template?: string) {
  return fillTemplate(template ?? DEFAULT_TEMPLATES.rentDue, { name, amount, month, room });
}

export function msgRentOverdue(name: string, amount: string, month: string, room: string, template?: string) {
  return fillTemplate(template ?? DEFAULT_TEMPLATES.rentOverdue, { name, amount, month, room });
}
