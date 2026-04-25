import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

const SESSION_DURATION_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_RENEW_BEFORE = 1 * 24 * 60 * 60 * 1000; // renew when < 1 day remains

export type AuthUser = {
  id:            string;
  email:         string;
  name:          string | null;
  role:          string;
  plan:          string;
  planExpiresAt: Date | null;
  passwordHash:  string;
  createdAt:     Date;
  updatedAt:     Date;
};

async function getSession(): Promise<{ user: AuthUser } | null> {
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
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return session as any as { user: AuthUser };
}

// For page routes — redirects to /login, returns the authenticated user
export async function requireAuth(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

// For API routes — returns the authenticated User, or a 401 NextResponse
// Usage:
//   const auth = await requireAuthAPI();
//   if (auth instanceof NextResponse) return auth;
//   const userId = auth.id;
export async function requireAuthAPI(): Promise<NextResponse | AuthUser> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return session.user;
}

// For admin page routes — redirects to /login or / if not admin
export async function requireAdmin(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/");
  return session.user;
}

// For admin API routes — returns the authenticated admin User, or 401/403
export async function requireAdminAPI(): Promise<NextResponse | AuthUser> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return session.user;
}
