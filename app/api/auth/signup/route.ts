import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { email, password } = body;

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = createHash("sha256").update(password).digest("hex");
  const token        = randomBytes(32).toString("hex");
  const expiresAt    = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  const user = await prisma.user.create({ data: { email, passwordHash } });
  await prisma.session.create({ data: { userId: user.id, token, expiresAt } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("rms_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
