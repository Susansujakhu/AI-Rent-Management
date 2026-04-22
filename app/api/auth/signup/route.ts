import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rate-limit";

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
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "Contact number is required" }, { status: 400 });
  }
  if (typeof otp !== "string" || otp.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit verification code" }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phone.trim());

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
  const expiresAt     = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

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
    maxAge:   60 * 60 * 24 * 30,
  });
  return res;
}
