import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("qrcode") as { toDataURL: (text: string, opts?: object) => Promise<string> };

// ── Key constants ─────────────────────────────────────────────────────────────
export const SYSTEM_WA_KEY = "system";

// ── Session state ─────────────────────────────────────────────────────────────

export type WAStatus = "disconnected" | "connecting" | "qr" | "ready";

interface WASession {
  socket:  WASocket | undefined;
  status:  WAStatus;
  qr:      string | null;
  qrImage: string | null;
  phone:   string | null;
}

interface WAGlobal {
  _waSessions: Map<string, WASession>;
}

const g = globalThis as typeof globalThis & WAGlobal;
if (!g._waSessions) g._waSessions = new Map();

function getOrCreate(key: string): WASession {
  if (!g._waSessions.has(key)) {
    g._waSessions.set(key, { socket: undefined, status: "disconnected", qr: null, qrImage: null, phone: null });
  }
  return g._waSessions.get(key)!;
}

// ── Public getters ────────────────────────────────────────────────────────────

export function getWAStatus(key: string):  WAStatus      { return getOrCreate(key).status; }
export function getWAQRImage(key: string): string | null { return getOrCreate(key).qrImage; }
export function getWAPhone(key: string):   string | null { return getOrCreate(key).phone; }

export function getWASession(key: string) {
  const s = getOrCreate(key);
  return { status: s.status, qrImage: s.qrImage, phone: s.phone };
}

// ── Connect / Disconnect ──────────────────────────────────────────────────────

export async function initWhatsApp(key: string): Promise<void> {
  const s = getOrCreate(key);
  if (s.socket || s.status === "connecting" || s.status === "ready") return;

  s.status  = "connecting";
  s.qr      = null;
  s.qrImage = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(`.wwebjs_auth/${key}`);
    const { version } = await fetchLatestBaileysVersion();

    const logger = pino({ level: "silent" });

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys:  makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      browser: ["Rent Manager", "Chrome", "120.0.0.0"],
    });

    s.socket = sock;

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        s.status = "qr";
        s.qr     = qr;
        try { s.qrImage = await QRCode.toDataURL(qr, { width: 300, margin: 2 }); }
        catch { s.qrImage = null; }
      }

      if (connection === "open") {
        s.status  = "ready";
        s.qr      = null;
        s.qrImage = null;
        s.phone   = sock.user?.id?.split(":")[0] ?? null;
        console.log(`[whatsapp:${key}] Connected as ${s.phone}`);
      }

      if (connection === "close") {
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;

        s.status  = "disconnected";
        s.qr      = null;
        s.qrImage = null;
        s.phone   = null;
        s.socket  = undefined;
        g._waSessions.delete(key);

        if (!loggedOut) {
          console.log(`[whatsapp:${key}] Reconnecting in 5s (code ${code})…`);
          setTimeout(() => initWhatsApp(key).catch(console.error), 5000);
        } else {
          console.log(`[whatsapp:${key}] Logged out — not reconnecting`);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

  } catch (err) {
    console.error("[whatsapp] initWhatsApp failed:", err);
    s.status  = "disconnected";
    s.socket  = undefined;
    g._waSessions.delete(key);
    throw err;
  }
}

export async function disconnectWhatsApp(key: string): Promise<void> {
  const s = g._waSessions.get(key);
  if (!s) return;
  try { await s.socket?.logout(); } catch { /* ignore */ }
  s.status  = "disconnected";
  s.qr      = null;
  s.qrImage = null;
  s.phone   = null;
  s.socket  = undefined;
  g._waSessions.delete(key);
}

// ── Send message ──────────────────────────────────────────────────────────────

export function formatWhatsAppJid(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  // Nepal 10-digit numbers — prepend country code
  if (digits.length === 10 && (digits.startsWith("98") || digits.startsWith("97"))) {
    digits = "977" + digits;
  }
  return digits + "@s.whatsapp.net";
}

/** @deprecated use formatWhatsAppJid */
export const formatWhatsAppId = formatWhatsAppJid;

export async function sendWhatsAppMessage(key: string, phone: string, message: string): Promise<boolean> {
  const s = g._waSessions.get(key);
  if (!s || s.status !== "ready" || !s.socket) return false;
  try {
    const jid = formatWhatsAppJid(phone);
    await s.socket.sendMessage(jid, { text: message });
    return true;
  } catch (err) {
    console.error("[whatsapp] sendMessage failed:", err);
    return false;
  }
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
