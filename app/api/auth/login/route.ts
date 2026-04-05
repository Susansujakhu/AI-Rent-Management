import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { email, password } = body;

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const hash = createHash("sha256").update(password).digest("hex");
  if (hash !== user.passwordHash) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

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
