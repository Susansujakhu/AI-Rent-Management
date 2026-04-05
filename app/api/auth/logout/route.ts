import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_session")?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => null);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("rms_session", "", { path: "/", maxAge: 0 });
  return res;
}
