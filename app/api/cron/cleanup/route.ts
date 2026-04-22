import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/cleanup
 * Purges expired sessions and used/expired OTP tokens.
 * Protected by CRON_SECRET env var — set the same value in your cron scheduler.
 *
 * Vercel cron example (vercel.json):
 *   { "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }] }
 *
 * Header required:  Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  const [sessions, otps] = await Promise.all([
    // Delete sessions that expired more than 1 day ago
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86_400_000) } } }),
    // Delete OTP tokens older than 24 hours or already used
    prisma.phoneVerificationToken.deleteMany({
      where: { OR: [{ used: true }, { expiresAt: { lt: now } }] },
    }),
    // Delete password reset tokens older than 1 hour
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => null),
  ]);

  return NextResponse.json({
    ok:              true,
    deletedSessions: sessions.count,
    deletedOtps:     otps.count,
    ts:              now.toISOString(),
  });
}
