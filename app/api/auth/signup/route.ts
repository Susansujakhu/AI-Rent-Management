import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";

const PASSWORD_MAX_BYTES = 72;

function normalizePhone(raw: string): string {
  const plus = raw.trimStart().startsWith("+") ? "+" : "";
  return plus + raw.replace(/\D/g, "");
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  if (!checkRateLimit(`signup:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many signup attempts. Please wait 15 minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { email, password, name, phone, otp } = body;

  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    return NextResponse.json({ error: `Password is too long (max ${PASSWORD_MAX_BYTES} bytes)` }, { status: 400 });
  }
  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "Contact number is required" }, { status: 400 });
  }
  if (typeof otp !== "string" || otp.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit verification code" }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phone.trim());

  // Cap verification attempts per phone so an attacker can't grind through the
  // 10^6 OTP keyspace by re-submitting different codes after one /send-phone-otp.
  const verifyKey = `verify-signup:${normalizedPhone}`;
  if (!checkRateLimit(verifyKey, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many incorrect codes. Please request a new code." }, { status: 429 });
  }

  // Verify OTP
  const token = await prisma.phoneVerificationToken.findFirst({
    where: {
      phone:     normalizedPhone,
      otp,
      used:      false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token) {
    return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 });
  }

  // OTP was correct — clear the failed-attempt counter so legitimate retries
  // (typo on first try) don't punish the user.
  clearRateLimit(verifyKey);

  // Check duplicates
  const normalizedEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
  const [emailTaken, phoneTaken] = await Promise.all([
    normalizedEmail ? prisma.user.findUnique({ where: { email: normalizedEmail } }) : null,
    prisma.user.findUnique({ where: { phone: normalizedPhone } }),
  ]);
  if (emailTaken) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  if (phoneTaken) return NextResponse.json({ error: "This phone number is already registered" }, { status: 409 });

  const passwordHash  = await bcrypt.hash(password, 12);
  const sessionToken  = randomBytes(32).toString("hex");
  const expiresAt     = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  // Mark OTP used + create user in one transaction
  const [, user] = await prisma.$transaction([
    prisma.phoneVerificationToken.update({ where: { id: token.id }, data: { used: true } }),
    prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        phone:         normalizedPhone,
        phoneVerified: true,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
      },
    }),
  ]);

  await prisma.session.create({ data: { userId: user.id, token: sessionToken, expiresAt } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("rms_session", sessionToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 7,
  });
  return res;
}
