import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";

/** Returns true if the hash is a legacy plain SHA-256 hex string (not bcrypt). */
function isLegacySha256(hash: string) {
  return /^[0-9a-f]{64}$/.test(hash);
}

/**
 * Dummy bcrypt hash used to run a constant-time compare when no user is found,
 * preventing email enumeration via response-time differences.
 */
const DUMMY_HASH = "$2b$12$invalidhashusedfortimingprotectiononly000000000000000000";

export async function POST(req: Request) {
  // Rate limiting — keyed by IP (falls back to "unknown" in dev)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait 15 minutes." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { email, password } = body;

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Transparent migration: support both legacy SHA-256 and modern bcrypt hashes.
  // Always run the expensive compare (even when user not found) to prevent
  // email enumeration via response-time differences.
  let passwordOk = false;
  const storedHash = user?.passwordHash ?? DUMMY_HASH;

  if (!user || !isLegacySha256(storedHash)) {
    // bcrypt path (or dummy path when user not found)
    passwordOk = user ? await bcrypt.compare(password, storedHash) : false;
    await bcrypt.compare(password, DUMMY_HASH); // always run for timing parity
  } else {
    // Legacy SHA-256 path
    const sha256 = createHash("sha256").update(password).digest("hex");
    if (sha256 === storedHash) {
      passwordOk = true;
      // Upgrade hash to bcrypt immediately
      const newHash = await bcrypt.hash(password, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    }
  }

  if (!passwordOk) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  // Clear rate-limit counter on successful login
  clearRateLimit(ip);

  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  // user is guaranteed non-null here: passwordOk=true only when user exists
  await prisma.session.create({ data: { userId: user!.id, token, expiresAt } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("rms_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
