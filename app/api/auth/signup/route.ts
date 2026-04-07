import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { email, password } = body;

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Only allow one account — block signup if any user already exists
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json({ error: "Registration is closed" }, { status: 403 });
  }
  // No need to check for duplicate email: if count=0 no users exist yet.

  const passwordHash = await bcrypt.hash(password, 12);
  const token        = randomBytes(32).toString("hex");
  const expiresAt    = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  const user = await prisma.user.create({ data: { email, passwordHash } });
  await prisma.session.create({ data: { userId: user.id, token, expiresAt } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("rms_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
