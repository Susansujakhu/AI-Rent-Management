import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import type { WASocket, WAVersion } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import fs from "fs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("qrcode") as { toDataURL: (text: string, opts?: object) => Promise<string> };

const AUTH_BASE   = path.join(process.cwd(), ".wwebjs_auth");
const SYSTEM_KEY  = "system";
const FALLBACK_WA_VERSION: WAVersion = [2, 3000, 1023205847];

let _cachedVersion: WAVersion | null = null;
async function getVersion(): Promise<WAVersion> {
  if (!_cachedVersion) {
    try { const { version } = await fetchLatestBaileysVersion(); _cachedVersion = version; }
    catch { _cachedVersion = FALLBACK_WA_VERSION; }
  }
  return _cachedVersion;
}

export type DirectWAStatus = "disconnected" | "connecting" | "qr" | "ready";

interface DirectWASession {
  socket:  WASocket | undefined;
  status:  DirectWAStatus;
  qrImage: string | null;
  phone:   string | null;
}

const g = globalThis as typeof globalThis & { _directWASession: DirectWASession };
if (!g._directWASession) {
  g._directWASession = { socket: undefined, status: "disconnected", qrImage: null, phone: null };
}

export function getDirectWASession() {
  const s = g._directWASession;
  return { status: s.status, qrImage: s.qrImage, phone: s.phone };
}

export async function initDirectWA(): Promise<void> {
  const s = g._directWASession;
  if (s.socket || s.status === "connecting" || s.status === "ready") return;

  s.status  = "connecting";
  s.qrImage = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(AUTH_BASE, SYSTEM_KEY));
    const version = await getVersion();

    const onExit = () => { saveCreds().catch(() => {}); };
    process.once("SIGTERM", onExit);
    process.once("SIGINT",  onExit);
    process.once("exit",    onExit);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys:  makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
      },
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: ["Rent Manager", "Chrome", "120.0.0.0"],
    });

    s.socket = sock;

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        s.status = "qr";
        try { s.qrImage = await QRCode.toDataURL(qr, { width: 300, margin: 2 }); }
        catch { s.qrImage = null; }
      }

      if (connection === "open") {
        s.status  = "ready";
        s.qrImage = null;
        s.phone   = sock.user?.id?.split(":")[0] ?? null;
        console.log(`[whatsapp:direct] Connected as ${s.phone}`);
      }

      if (connection === "close") {
        const code             = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut        = code === DisconnectReason.loggedOut;
        const connReplaced     = code === DisconnectReason.connectionReplaced;

        s.status  = "disconnected";
        s.qrImage = null;
        s.phone   = null;
        s.socket  = undefined;

        if (loggedOut || connReplaced) {
          console.log(`[whatsapp:direct] ${connReplaced ? "Connection replaced" : "Logged out"} — clearing creds`);
          try { fs.rmSync(path.join(AUTH_BASE, SYSTEM_KEY), { recursive: true, force: true }); } catch { /* ignore */ }
        } else {
          console.log(`[whatsapp:direct] Reconnecting in 5s (code ${code})…`);
          setTimeout(() => initDirectWA().catch(console.error), 5_000);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

  } catch (err) {
    console.error("[whatsapp:direct] init failed:", err);
    const s2 = g._directWASession;
    s2.status = "disconnected";
    s2.socket = undefined;
    setTimeout(() => initDirectWA().catch(console.error), 15_000);
  }
}

export async function disconnectDirectWA(): Promise<void> {
  const s = g._directWASession;
  try { await s.socket?.logout(); } catch { /* ignore */ }
  s.status  = "disconnected";
  s.qrImage = null;
  s.phone   = null;
  s.socket  = undefined;
}

export async function sendDirectMessage(phone: string, message: string): Promise<boolean> {
  const s = g._directWASession;
  if (s.status !== "ready" || !s.socket) return false;
  try {
    let digits = phone.replace(/\D/g, "");
    if (digits.length === 10 && (digits.startsWith("98") || digits.startsWith("97"))) {
      digits = "977" + digits;
    }
    await s.socket.sendMessage(digits + "@s.whatsapp.net", { text: message });
    return true;
  } catch (err) {
    console.error("[whatsapp:direct] sendMessage failed:", err);
    return false;
  }
}

export async function autoStartDirectWA(): Promise<void> {
  const authDir = path.join(AUTH_BASE, SYSTEM_KEY);
  if (!fs.existsSync(authDir)) return;
  try {
    const { prisma } = await import("./prisma");
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      SELECT \`value\` FROM \`GlobalSetting\` WHERE \`key\` = 'wa_mode' LIMIT 1
    `;
    if (rows[0]?.value !== "direct") return;
  } catch { return; }
  await initDirectWA();
}
