import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, isWhatsAppReady } from "@/lib/whatsapp";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

function otpEmailHtml(otp: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:420px">
    <p style="font-size:15px;color:#1e293b">Your EasyRent verification code is:</p>
    <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#4f46e5;margin:12px 0">${otp}</p>
    <p style="font-size:13px;color:#64748b">This code expires in 15 minutes. Don't share it with anyone.</p>
  </div>`;
}

const DEV_BYPASS = process.env.NODE_ENV !== "production" && process.env.BYPASS_PHONE_OTP === "true";
const DEV_OTP    = "000000"; // fixed code used in bypass mode

// Keep in sync with /api/auth/signup — these match exactly so anything the
// OTP-send endpoint accepts is guaranteed to be accepted by signup.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES  = 72; // bcrypt silently truncates beyond 72 bytes

function generateOTP(): string {
  // Use a CSPRNG so the 6-digit code can't be predicted from a Math.random()
  // seed leak. randomInt's upper bound is exclusive.
  return String(randomInt(100000, 1000000));
}

function normalizePhone(raw: string): string {
  const plus = raw.trimStart().startsWith("+") ? "+" : "";
  return plus + raw.replace(/\D/g, "");
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  if (!checkRateLimit(`phone-otp:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please wait 15 minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { phone, email, password } = body;

  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  // Validate password here (when supplied) so the verify screen never has to
  // surface password errors — by the time the OTP is sent, the password is
  // already known to be acceptable. /api/auth/signup will re-check for
  // defense in depth, but a legitimate flow will never see a server password
  // rejection on the verify step.
  if (password !== undefined && password !== null && password !== "") {
    if (typeof password !== "string") {
      return NextResponse.json({ error: "Password must be a string" }, { status: 400 });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` }, { status: 400 });
    }
    if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
      return NextResponse.json({ error: `Password is too long (max ${PASSWORD_MAX_BYTES} bytes)` }, { status: 400 });
    }
  }

  // Email is required (used as a fallback delivery channel for notifications).
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!z.string().email().safeParse(email.trim()).success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const emailTaken = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (emailTaken) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const normalized = normalizePhone(phone.trim());
  const digits     = normalized.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return NextResponse.json({ error: "Enter a valid phone number (7–15 digits)" }, { status: 400 });
  }

  // Check if phone is already registered
  const existing = await prisma.user.findUnique({ where: { phone: normalized } });
  if (existing) {
    return NextResponse.json({ error: "This phone number is already registered" }, { status: 409 });
  }

  // ── Dev bypass: skip WA, use fixed OTP "000000" ──────────────────────────
  if (DEV_BYPASS) {
    await prisma.phoneVerificationToken.updateMany({
      where: { phone: normalized, used: false },
      data:  { used: true },
    });
    await prisma.phoneVerificationToken.create({
      data: { phone: normalized, otp: DEV_OTP, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    });
    const masked = digits.slice(0, 2) + "****" + digits.slice(-2);
    console.log(`[DEV] Phone OTP bypass — code is ${DEV_OTP} for ${normalized}`);
    return NextResponse.json({ ok: true, masked, dev: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // We need at least one delivery channel available (WhatsApp ready OR email
  // configured). Otherwise there's no way to get the code to the user.
  const waReady = await isWhatsAppReady();
  if (!waReady && !isEmailConfigured()) {
    return NextResponse.json({ error: "No verification channel available — contact the admin to complete signup" }, { status: 503 });
  }

  // Invalidate previous tokens for this phone
  await prisma.phoneVerificationToken.updateMany({
    where: { phone: normalized, used: false },
    data:  { used: true },
  });

  const otp       = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.phoneVerificationToken.create({
    data: { phone: normalized, otp, expiresAt },
  });

  // Send the code over BOTH channels in parallel. The account doesn't exist
  // yet, so the email is taken from the signup form (sendWhatsAppMessage's
  // DB-based email mirror can't find it). Succeed if EITHER channel delivers.
  const waMsg = `Your EasyRent verification code is:\n\n*${otp}*\n\nThis code expires in 15 minutes. Don't share it with anyone.`;
  const [waSent, emailSent] = await Promise.all([
    waReady ? sendWhatsAppMessage(normalized, waMsg, { skipEmailMirror: true }).catch(() => false) : Promise.resolve(false),
    sendEmail(email.trim(), "Your EasyRent verification code", otpEmailHtml(otp),
      `Your EasyRent verification code is ${otp}. It expires in 15 minutes.`).catch(() => false),
  ]);

  if (!waSent && !emailSent) {
    return NextResponse.json({ error: "Couldn't send the code over WhatsApp or email. Please try again." }, { status: 500 });
  }

  const masked = digits.slice(0, 2) + "****" + digits.slice(-2);
  // Tell the client which channels actually went out so the verify screen
  // can say "check your WhatsApp and email".
  return NextResponse.json({ ok: true, masked, channels: { whatsapp: waSent, email: emailSent } });
}
