import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, isWhatsAppReady } from "@/lib/whatsapp";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

const DEV_BYPASS = process.env.NODE_ENV !== "production" && process.env.BYPASS_PHONE_OTP === "true";
const DEV_OTP    = "000000";

function generateOTP(): string {
  // CSPRNG — see send-phone-otp/route.ts for rationale.
  return String(randomInt(100000, 1000000));
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

  // Server-state gate: need at least one delivery channel (WhatsApp OR email).
  if (!DEV_BYPASS && !(await isWhatsAppReady()) && !isEmailConfigured()) {
    return NextResponse.json(
      { error: "Password reset is unavailable — no delivery channel configured. Contact the admin." },
      { status: 503 }
    );
  }

  // Always return the same response shape regardless of whether the user exists,
  // to avoid handing attackers a phone-number enumeration oracle.
  const okResponse = NextResponse.json({ ok: true, sent: true, masked: maskPhone(phone) });

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.phone) return okResponse;

  if (DEV_BYPASS) {
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });
    await prisma.passwordResetToken.create({ data: { userId: user.id, otp: DEV_OTP, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
    console.log(`[DEV] Password reset bypass — code is ${DEV_OTP} for ${phone}`);
    return okResponse;
  }

  const otp       = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.passwordResetToken.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });
  await prisma.passwordResetToken.create({ data: { userId: user.id, otp, expiresAt } });

  const msg = `Your EasyRent password reset code is:\n\n*${otp}*\n\nThis code expires in 15 minutes. If you didn't request this, ignore this message.`;
  // Send over both channels in parallel. sendWhatsAppMessage already mirrors to
  // the user's email via DB lookup, but we also send explicitly so a missing/
  // mismatched phone record still gets the email. De-dup isn't worth the
  // complexity here — at most the user gets two identical emails.
  const emailHtml = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:420px">
    <p style="font-size:15px;color:#1e293b">Your EasyRent password reset code is:</p>
    <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#4f46e5;margin:12px 0">${otp}</p>
    <p style="font-size:13px;color:#64748b">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
  </div>`;
  const [waSent] = await Promise.all([
    (await isWhatsAppReady()) ? sendWhatsAppMessage(user.phone, msg, { skipEmailMirror: true }).catch(() => false) : Promise.resolve(false),
    user.email
      ? sendEmail(user.email, "Your EasyRent password reset code", emailHtml,
          `Your EasyRent password reset code is ${otp}. It expires in 15 minutes.`).catch(() => false)
      : Promise.resolve(false),
  ]);
  if (!waSent) {
    console.error(`[forgot-password] WhatsApp send failed for user ${user.id} (email fallback attempted)`);
  }

  return okResponse;
}
