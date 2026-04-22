import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, getWAStatus, SYSTEM_WA_KEY } from "@/lib/whatsapp";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const { email } = body;

  if (typeof email !== "string" || !email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Always return the same response to prevent email enumeration
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: true, sent: false, masked: null });
  }

  if (getWAStatus(SYSTEM_WA_KEY) !== "ready" || !user.phone) {
    return NextResponse.json(
      { error: "Password reset is unavailable — WhatsApp is not connected or no phone number is on file. Contact the admin." },
      { status: 503 }
    );
  }

  const otp       = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data:  { used: true },
  });

  await prisma.passwordResetToken.create({
    data: { userId: user.id, otp, expiresAt },
  });

  const msg  = `Your Rent Manager password reset code is:\n\n*${otp}*\n\nThis code expires in 15 minutes. If you didn't request this, ignore this message.`;
  const sent = await sendWhatsAppMessage(SYSTEM_WA_KEY, user.phone, msg);

  if (!sent) {
    return NextResponse.json(
      { error: "Failed to send WhatsApp message. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok:     true,
    sent:   true,
    masked: maskPhone(user.phone),
  });
}
