import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, getWAStatus, SYSTEM_WA_KEY } from "@/lib/whatsapp";
import { checkRateLimit } from "@/lib/rate-limit";

const DEV_BYPASS = process.env.NODE_ENV !== "production" && process.env.BYPASS_PHONE_OTP === "true";
const DEV_OTP    = "000000";

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "****";
  return digits.slice(0, 2) + "****" + digits.slice(-3);
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  if (!checkRateLimit(`forgot-pw:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please wait 15 minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { phone } = body;

  if (typeof phone !== "string" || !phone) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return NextResponse.json({ error: "No account found with that phone number." }, { status: 404 });
  }

  // ── Dev bypass ───────────────────────────────────────────────────────────
  if (DEV_BYPASS) {
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });
    await prisma.passwordResetToken.create({ data: { userId: user.id, otp: DEV_OTP, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
    console.log(`[DEV] Password reset bypass — code is ${DEV_OTP} for ${phone}`);
    return NextResponse.json({ ok: true, sent: true, masked: user.phone ? maskPhone(user.phone) : "bypass" });
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (getWAStatus(SYSTEM_WA_KEY) !== "ready" || !user.phone) {
    return NextResponse.json(
      { error: "Password reset requires WhatsApp to be connected. Contact the admin." },
      { status: 503 }
    );
  }

  const otp       = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.passwordResetToken.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });
  await prisma.passwordResetToken.create({ data: { userId: user.id, otp, expiresAt } });

  const msg  = `Your Rent Manager password reset code is:\n\n*${otp}*\n\nThis code expires in 15 minutes. If you didn't request this, ignore this message.`;
  const sent = await sendWhatsAppMessage(SYSTEM_WA_KEY, user.phone, msg);

  if (!sent) {
    return NextResponse.json({ error: "Failed to send WhatsApp message. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: true, masked: maskPhone(user.phone) });
}
