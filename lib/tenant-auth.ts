import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

const SESSION_DURATION_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_RENEW_BEFORE =  7 * 24 * 60 * 60 * 1000; // renew if < 7 days left

async function getTenantSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_tenant_session")?.value;
  if (!token) return null;

  const session = await prisma.tenantSession.findUnique({
    where: { token },
    include: { tenant: { include: { room: true } } },
  });

  if (!session) return null;

  const now = new Date();

  // Expired
  if (session.expiresAt < now) {
    await prisma.tenantSession.delete({ where: { token } }).catch(() => null);
    return null;
  }

  // Owner revoked portal access
  if (!session.tenant.portalEnabled) {
    await prisma.tenantSession.delete({ where: { token } }).catch(() => null);
    return null;
  }

  // Sliding expiry
  const timeLeft = session.expiresAt.getTime() - now.getTime();
  if (timeLeft < SESSION_RENEW_BEFORE) {
    const newExpiry = new Date(now.getTime() + SESSION_DURATION_MS);
    await prisma.tenantSession
      .update({ where: { token }, data: { expiresAt: newExpiry } })
      .catch(() => null);
    session.expiresAt = newExpiry;
  }

  return session;
}

/** For portal page routes — redirects to /portal if not authenticated. */
export async function requireTenantPage() {
  const session = await getTenantSession();
  if (!session) redirect("/portal");
  return session;
}

/** For portal API routes — returns 401 JSON or null if OK. */
export async function requireTenantAPI(): Promise<
  { tenant: Awaited<ReturnType<typeof getTenantSession>>; unauth: null } |
  { tenant: null; unauth: NextResponse }
> {
  const session = await getTenantSession();
  if (!session) {
    return {
      tenant: null,
      unauth: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { tenant: session, unauth: null };
}

/** Set the tenant session cookie on a response. */
export function setTenantSessionCookie(res: NextResponse, token: string) {
  res.cookies.set("rms_tenant_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/portal",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Clear the tenant session cookie on a response. */
export function clearTenantSessionCookie(res: NextResponse) {
  res.cookies.set("rms_tenant_session", "", {
    path: "/portal",
    maxAge: 0,
  });
}
