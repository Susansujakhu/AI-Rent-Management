import { Client, LocalAuth } from "whatsapp-web.js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("qrcode") as { toDataURL: (text: string, opts?: object) => Promise<string> };

// ── Key constants ─────────────────────────────────────────────────────────────
// "system" = admin-owned WhatsApp for sending auth OTPs (signup, login, forgot-pw)
// userId   = each landlord's own WhatsApp for sending tenant messages
export const SYSTEM_WA_KEY = "system";

// ── Session state ─────────────────────────────────────────────────────────────

export type WAStatus = "disconnected" | "connecting" | "qr" | "ready";

interface WASession {
  client:  Client | undefined;
  status:  WAStatus;
  qr:      string | null;
  qrImage: string | null;
  phone:   string | null;
}

interface WAGlobal {
  _waSessions: Map<string, WASession>;
}

const g = globalThis as typeof globalThis & WAGlobal;

if (!g._waSessions) {
  g._waSessions = new Map();
}

function getOrCreate(key: string): WASession {
  if (!g._waSessions.has(key)) {
    g._waSessions.set(key, {
      client:  undefined,
      status:  "disconnected",
      qr:      null,
      qrImage: null,
      phone:   null,
    });
  }
  return g._waSessions.get(key)!;
}

// ── Public getters ────────────────────────────────────────────────────────────

export function getWAStatus(key: string):  WAStatus        { return getOrCreate(key).status; }
export function getWAQRImage(key: string): string | null   { return getOrCreate(key).qrImage; }
export function getWAPhone(key: string):   string | null   { return getOrCreate(key).phone; }

export function getWASession(key: string) {
  const s = getOrCreate(key);
  return { status: s.status, qrImage: s.qrImage, phone: s.phone };
}

// ── Connect / Disconnect ──────────────────────────────────────────────────────

export async function initWhatsApp(key: string): Promise<void> {
  const s = getOrCreate(key);
  if (s.client || s.status === "connecting" || s.status === "ready") return;

  s.status = "connecting";

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth", clientId: key }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  client.on("qr", async (qr) => {
    s.qr     = qr;
    s.status = "qr";
    try {
      s.qrImage = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
    } catch {
      s.qrImage = null;
    }
  });

  client.on("authenticated", () => {
    s.qr      = null;
    s.qrImage = null;
  });

  client.on("ready", () => {
    s.status  = "ready";
    s.qr      = null;
    s.qrImage = null;
    s.phone   = client.info?.wid?.user ?? null;
  });

  client.on("disconnected", () => {
    s.status  = "disconnected";
    s.qr      = null;
    s.qrImage = null;
    s.phone   = null;
    s.client  = undefined;
    g._waSessions.delete(key);
  });

  client.on("auth_failure", () => {
    s.status = "disconnected";
    s.client = undefined;
    g._waSessions.delete(key);
  });

  s.client = client;
  await client.initialize();
}

export async function disconnectWhatsApp(key: string): Promise<void> {
  const s = g._waSessions.get(key);
  if (!s?.client) return;
  await s.client.destroy().catch(() => null);
  g._waSessions.delete(key);
}

// ── Send message ──────────────────────────────────────────────────────────────

/** Format a phone number to WhatsApp ID format: <digits>@c.us */
export function formatWhatsAppId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // 10-digit Nepal numbers (98XXXXXXXX / 97XXXXXXXX) — prepend 977
  if (digits.length === 10 && (digits.startsWith("98") || digits.startsWith("97"))) {
    return `977${digits}@c.us`;
  }
  return `${digits}@c.us`;
}

export async function sendWhatsAppMessage(key: string, phone: string, message: string): Promise<boolean> {
  const s = g._waSessions.get(key);
  if (s?.status !== "ready" || !s.client) return false;
  try {
    const chatId = formatWhatsAppId(phone);
    await s.client.sendMessage(chatId, message);
    return true;
  } catch {
    return false;
  }
}

// ── Message templates ─────────────────────────────────────────────────────────
// Placeholders: {name}, {amount}, {month}, {room}

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
    // Remove any line that still contains the {receipt} placeholder
    result = result.split("\n").filter(l => !l.includes("{receipt}")).join("\n").trimEnd();
  }
  return result;
}

export function buildMessage(template: string, vars: { name: string; amount: string; month: string; room: string }) {
  return fillTemplate(template, vars);
}

export function msgPaymentReceived(name: string, amount: string, month: string, room: string, template?: string, receiptUrl?: string, breakdownLines?: string[]) {
  let msg = fillTemplate(template ?? DEFAULT_TEMPLATES.paymentReceived, { name, amount, month, room, receipt: receiptUrl });
  if (breakdownLines && breakdownLines.length > 0) {
    msg += "\n\n*Breakdown:*\n" + breakdownLines.join("\n");
  }
  return msg;
}

export function msgRentDue(name: string, amount: string, month: string, room: string, template?: string) {
  return fillTemplate(template ?? DEFAULT_TEMPLATES.rentDue, { name, amount, month, room });
}

export function msgRentOverdue(name: string, amount: string, month: string, room: string, template?: string) {
  return fillTemplate(template ?? DEFAULT_TEMPLATES.rentOverdue, { name, amount, month, room });
}
