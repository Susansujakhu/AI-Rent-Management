import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";

const PASSWORD_MAX_BYTES = 72;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { phone, otp, newPassword } = body;

  if (typeof phone !== "string" || typeof otp !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Phone number, code, and new password are required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (Buffer.byteLength(newPassword, "utf8") > PASSWORD_MAX_BYTES) {
    return NextResponse.json({ error: `Password is too long (max ${PASSWORD_MAX_BYTES} bytes)` }, { status: 400 });
  }

  // Cap OTP verification attempts per phone — same rationale as signup.
  const verifyKey = `verify-reset:${phone}`;
  if (!checkRateLimit(verifyKey, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many incorrect codes. Please request a new code." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const token = await prisma.passwordResetToken.findFirst({
    where: {
      userId:    user.id,
      otp,
      used:      false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  clearRateLimit(verifyKey);

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    // Mark token as used
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { used: true } }),
    // Update password
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    // Invalidate all existing sessions (force re-login)
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
