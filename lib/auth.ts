import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_session")?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } });
    return null;
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
