import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clearTenantSessionCookie } from "@/lib/tenant-auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_tenant_session")?.value;

  if (token) {
    await prisma.tenantSession.deleteMany({ where: { token } }).catch(() => null);
  }

  const res = NextResponse.json({ ok: true });
  clearTenantSessionCookie(res);
  return res;
}
