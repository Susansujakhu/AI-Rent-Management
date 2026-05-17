import path from "path";
import fs from "fs";

const APP_ROOT    = process.env.WA_APP_ROOT    ?? process.cwd();
const AUTH_BASE   = process.env.WA_AUTH_DIR    ?? path.join(APP_ROOT, ".wwebjs_auth");
const RUNTIME_DIR = process.env.WA_RUNTIME_DIR ?? path.join(APP_ROOT, ".wa-runtime");
const STATE_FILE  = path.join(RUNTIME_DIR, "state.json");
const SYSTEM_KEY  = "system";

// Owner-state freshness window. Owner re-writes state every HEARTBEAT_MS;
// readers treat anything older than STATE_TTL_MS as a dead owner.
const HEARTBEAT_MS = 20_000;
const STATE_TTL_MS = 60_000;

export type DirectWAStatus = "disconnected" | "connecting" | "qr" | "ready";

interface DirectWASession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket:         any;
  status:         DirectWAStatus;
  qrImage:        string | null;
  phone:          string | null;
  heartbeatTimer: NodeJS.Timeout | undefined;
}

interface PersistedState {
  status:  DirectWAStatus;
  qrImage: string | null;
  phone:   string | null;
  pid:     number;
  ts:      number;
}

const g = globalThis as typeof globalThis & { _directWASession: DirectWASession };
if (!g._directWASession) {
  g._directWASession = { socket: undefined, status: "disconnected", qrImage: null, phone: null, heartbeatTimer: undefined };
}

function ensureRuntimeDir() {
  try { fs.mkdirSync(RUNTIME_DIR, { recursive: true }); } catch { /* ignore */ }
}

function writeState() {
  const s = g._directWASession;
  ensureRuntimeDir();
  const payload: PersistedState = {
    status:  s.status,
    qrImage: s.qrImage,
    phone:   s.phone,
    pid:     process.pid,
    ts:      Date.now(),
  };
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(payload)); } catch { /* ignore */ }
}

function readState(): PersistedState | null {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

// True if a *different* worker has an active socket and is heartbeating.
function isOtherWorkerOwner(): boolean {
  const s = g._directWASession;
  if (s.socket) return false;
  const persisted = readState();
  if (!persisted) return false;
  if (persisted.pid === process.pid) return false;
  const fresh = Date.now() - persisted.ts < STATE_TTL_MS;
  return fresh && persisted.status !== "disconnected";
}

function startHeartbeat() {
  const s = g._directWASession;
  if (s.heartbeatTimer) return;
  s.heartbeatTimer = setInterval(() => writeState(), HEARTBEAT_MS);
  if (s.heartbeatTimer.unref) s.heartbeatTimer.unref();
}

function stopHeartbeat() {
  const s = g._directWASession;
  if (s.heartbeatTimer) { clearInterval(s.heartbeatTimer); s.heartbeatTimer = undefined; }
}

export function getDirectWASession() {
  const s = g._directWASession;
  // Owner worker: trust in-memory state.
  if (s.socket) return { status: s.status, qrImage: s.qrImage, phone: s.phone };

  // Non-owner worker: fall back to the persisted state, but only if it's fresh.
  const persisted = readState();
  if (persisted && Date.now() - persisted.ts < STATE_TTL_MS) {
    return { status: persisted.status, qrImage: persisted.qrImage, phone: persisted.phone };
  }
  return { status: s.status, qrImage: s.qrImage, phone: s.phone };
}

export async function initDirectWA(): Promise<void> {
  const s = g._directWASession;
  if (s.socket || s.status === "connecting" || s.status === "ready") return;

  // Another worker already owns an active WA socket — don't start a second one;
  // two sockets sharing the same creds make WhatsApp emit `connectionReplaced`
  // and trash the session.
  if (isOtherWorkerOwner()) {
    console.log("[whatsapp:direct] Another worker owns the WA socket — not initializing");
    return;
  }

  s.status  = "connecting";
  s.qrImage = null;
  writeState();
  startHeartbeat();

  try {
    const baileys = await import("@whiskeysockets/baileys");
    const makeWASocket               = baileys.default;
    const { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = baileys;
    const { Boom }  = await import("@hapi/boom");
    const pino      = (await import("pino")).default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const QRCode    = require("qrcode") as { toDataURL: (text: string, opts?: object) => Promise<string> };

    type WAVersion = [number, number, number];
    const FALLBACK: WAVersion = [2, 3000, 1023205847];
    let version: WAVersion;
    try { const r = await fetchLatestBaileysVersion(); version = r.version as WAVersion; }
    catch { version = FALLBACK; }

    const { state, saveCreds } = await useMultiFileAuthState(path.join(AUTH_BASE, SYSTEM_KEY));

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

    sock.ev.on("connection.update", async (update: { connection?: string; lastDisconnect?: { error?: unknown }; qr?: string }) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        s.status = "qr";
        try { s.qrImage = await QRCode.toDataURL(qr, { width: 300, margin: 2 }); }
        catch { s.qrImage = null; }
        writeState();
      }

      if (connection === "open") {
        s.status  = "ready";
        s.qrImage = null;
        s.phone   = sock.user?.id?.split(":")[0] ?? null;
        writeState();
        console.log(`[whatsapp:direct] Connected as ${s.phone}`);
      }

      if (connection === "close") {
        const code         = (lastDisconnect?.error as InstanceType<typeof Boom>)?.output?.statusCode;
        const loggedOut    = code === DisconnectReason.loggedOut;
        const connReplaced = code === DisconnectReason.connectionReplaced;

        s.status  = "disconnected";
        s.qrImage = null;
        s.phone   = null;
        s.socket  = undefined;
        writeState();
        stopHeartbeat();

        if (loggedOut) {
          console.log("[whatsapp:direct] Logged out — clearing creds");
          try { fs.rmSync(path.join(AUTH_BASE, SYSTEM_KEY), { recursive: true, force: true }); } catch { /* ignore */ }
        } else if (connReplaced) {
          // Another worker (or device) opened a session with the same creds.
          // Yield: do NOT wipe creds and do NOT auto-reconnect — the other
          // owner is now serving requests, and racing it would loop forever.
          console.log("[whatsapp:direct] Connection replaced by another worker/device — yielding");
        } else {
          console.log(`[whatsapp:direct] Reconnecting in 5s (code ${code})…`);
          setTimeout(() => initDirectWA().catch(console.error), 5_000);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

  } catch (err) {
    const s2 = g._directWASession;
    s2.status = "disconnected";
    s2.socket = undefined;
    writeState();
    stopHeartbeat();
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND") {
      // Don't retry — the package is missing and reconnecting won't fix that.
      console.error("[whatsapp:direct] Required package missing on this server. Run on cPanel:");
      console.error("[whatsapp:direct]   npm install --ignore-scripts @whiskeysockets/baileys @hapi/boom pino qrcode");
      console.error("[whatsapp:direct] then `touch tmp/restart.txt`. Original error:", (err as Error).message);
    } else {
      console.error("[whatsapp:direct] init failed:", err);
      setTimeout(() => initDirectWA().catch(console.error), 15_000);
    }
  }
}

export async function disconnectDirectWA(): Promise<void> {
  const s = g._directWASession;
  try { await s.socket?.logout?.(); } catch { /* ignore */ }
  s.status  = "disconnected";
  s.qrImage = null;
  s.phone   = null;
  s.socket  = undefined;
  writeState();
  stopHeartbeat();
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
  if (isOtherWorkerOwner()) {
    console.log("[whatsapp:direct] autoStart skipped — another worker owns the WA socket");
    return;
  }
  try {
    const { prisma } = await import("./prisma");
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      SELECT \`value\` FROM \`GlobalSetting\` WHERE \`key\` = 'wa_mode' LIMIT 1
    `;
    if (rows[0]?.value !== "direct") return;
  } catch { return; }
  await initDirectWA();
}
