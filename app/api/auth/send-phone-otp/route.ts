import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, getWAStatus, SYSTEM_WA_KEY } from "@/lib/whatsapp";
import { checkRateLimit } from "@/lib/rate-limit";

const DEV_BYPASS = process.env.NODE_ENV !== "production" && process.env.BYPASS_PHONE_OTP === "true";
const DEV_OTP    = "000000"; // fixed code used in bypass mode

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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
  const { phone } = body;

  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
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

  if (getWAStatus(SYSTEM_WA_KEY) !== "ready") {
    return NextResponse.json({ error: "WhatsApp is not connected — contact the admin to complete signup" }, { status: 503 });
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

  const msg  = `Your Rent Manager verification code is:\n\n*${otp}*\n\nThis code expires in 15 minutes. Don't share it with anyone.`;
  const sent = await sendWhatsAppMessage(SYSTEM_WA_KEY, normalized, msg);

  if (!sent) {
    return NextResponse.json({ error: "Failed to send WhatsApp message. Make sure this number is on WhatsApp." }, { status: 500 });
  }

  const masked = digits.slice(0, 2) + "****" + digits.slice(-2);
  return NextResponse.json({ ok: true, masked });
}
