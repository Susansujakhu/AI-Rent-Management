import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";

// bcrypt silently truncates inputs >72 bytes, so an attacker who knows the
// first 72 bytes can authenticate as the user regardless of suffix.
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72;

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate-limit by user id (not IP) so a stolen cookie can't brute-force the
  // current password across many IPs.
  const rlKey = `change-pw:${session.user.id}`;
  if (!checkRateLimit(rlKey, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait 15 minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { currentPassword, newPassword, newEmail } = body;

  if (typeof currentPassword !== "string" || !currentPassword) {
    return NextResponse.json({ error: "Current password is required" }, { status: 400 });
  }

  // Support both legacy SHA-256 and bcrypt hashes
  const storedHash = session.user.passwordHash;
  const isLegacy   = /^[0-9a-f]{64}$/.test(storedHash);
  const currentOk  = isLegacy
    ? createHash("sha256").update(currentPassword).digest("hex") === storedHash
    : await bcrypt.compare(currentPassword, storedHash);

  if (!currentOk) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  // Right password — clear the rate-limit window so a legitimate retry after
  // a typo isn't punished.
  clearRateLimit(rlKey);

  const updates: { passwordHash?: string; email?: string } = {};

  if (typeof newPassword === "string" && newPassword) {
    const trimmed = newPassword.trim();
    if (trimmed.length < PASSWORD_MIN) {
      return NextResponse.json({ error: `Password must be at least ${PASSWORD_MIN} characters` }, { status: 400 });
    }
    if (Buffer.byteLength(trimmed, "utf8") > PASSWORD_MAX_BYTES) {
      return NextResponse.json({ error: `Password is too long (max ${PASSWORD_MAX_BYTES} bytes)` }, { status: 400 });
    }
    updates.passwordHash = await bcrypt.hash(trimmed, 12);
  }

  if (typeof newEmail === "string" && newEmail && newEmail !== session.user.email) {
    const taken = await prisma.user.findUnique({ where: { email: newEmail } });
    if (taken) return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    updates.email = newEmail;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  // Apply the change and kill any OTHER sessions in the same transaction so a
  // stolen cookie loses access the moment the legitimate user updates creds.
  // We keep the caller's current session so the UI doesn't bounce them.
  await prisma.$transaction([
    prisma.user.update({ where: { id: session.user.id }, data: updates }),
    prisma.session.deleteMany({
      where: { userId: session.user.id, NOT: { token } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
