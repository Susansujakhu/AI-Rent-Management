import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

const SESSION_DURATION_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_RENEW_BEFORE = 7  * 24 * 60 * 60 * 1000; // renew when < 7 days remain

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_session")?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;

  const now = new Date();
  if (session.expiresAt < now) {
    await prisma.session.delete({ where: { token } });
    return null;
  }

  // Sliding expiry: extend the session if it's close to expiring
  const timeLeft = session.expiresAt.getTime() - now.getTime();
  if (timeLeft < SESSION_RENEW_BEFORE) {
    const newExpiry = new Date(now.getTime() + SESSION_DURATION_MS);
    await prisma.session.update({ where: { token }, data: { expiresAt: newExpiry } });
    session.expiresAt = newExpiry;
  }

  return session;
}

// For page routes — redirects to /login
export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login");
}

// For API routes — returns 401 JSON, or null if OK
export async function requireAuthAPI(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
