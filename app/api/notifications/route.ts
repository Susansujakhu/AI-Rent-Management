import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RawNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  read: number | boolean;
  createdAt: Date;
};

export async function GET() {
  try {
    const user = await requireAuthAPI();
    if (user instanceof NextResponse) return user;

    const notifications = await prisma.$queryRaw<RawNotification[]>`
      SELECT id, userId, type, title, body, data, \`read\`, createdAt
      FROM \`Notification\`
      WHERE userId = ${user.id}
      ORDER BY createdAt DESC
      LIMIT 50
    `;

    const normalized = notifications.map(n => ({
      ...n,
      read: n.read === 1 || n.read === true,
    }));

    const unreadCount = normalized.filter(n => !n.read).length;

    return NextResponse.json({ notifications: normalized, unreadCount });
  } catch (e: any) {
    console.error("[notifications GET]", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const user = await requireAuthAPI();
    if (user instanceof NextResponse) return user;

    await prisma.$executeRaw`
      UPDATE \`Notification\`
      SET \`read\` = 1
      WHERE userId = ${user.id} AND \`read\` = 0
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[notifications PATCH]", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
