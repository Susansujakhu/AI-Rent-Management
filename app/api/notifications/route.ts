import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await requireAuthAPI();
  if (user instanceof NextResponse) return user;

  const notifications = await prisma.notification.findMany({
    where:   { userId: user.id },
    orderBy: { createdAt: "desc" },
    take:    50,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH() {
  const user = await requireAuthAPI();
  if (user instanceof NextResponse) return user;

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data:  { read: true },
  });

  return NextResponse.json({ ok: true });
}
