import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { currentPassword, newPassword, newEmail } = body;

  if (typeof currentPassword !== "string" || !currentPassword) {
    return NextResponse.json({ error: "Current password is required" }, { status: 400 });
  }

  const currentHash = createHash("sha256").update(currentPassword).digest("hex");
  if (currentHash !== session.user.passwordHash) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const updates: { passwordHash?: string; email?: string } = {};

  if (typeof newPassword === "string" && newPassword) {
    if (newPassword.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    updates.passwordHash = createHash("sha256").update(newPassword).digest("hex");
  }

  if (typeof newEmail === "string" && newEmail && newEmail !== session.user.email) {
    const taken = await prisma.user.findUnique({ where: { email: newEmail } });
    if (taken) return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    updates.email = newEmail;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: updates });
  return NextResponse.json({ ok: true });
}
