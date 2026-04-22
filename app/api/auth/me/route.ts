import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (prisma.session.findUnique as any)({
    where: { token },
    include: { user: { select: { id: true, email: true, name: true, plan: true, role: true, upgradeRequestedAt: true, createdAt: true } } },
  }) as { expiresAt: Date; user: Record<string, unknown> } | null;

  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(session.user);
}
