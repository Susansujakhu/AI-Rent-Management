import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuthAPI();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  await prisma.$executeRaw`
    UPDATE \`Notification\`
    SET \`read\` = 1
    WHERE id = ${id} AND userId = ${user.id}
  `;

  return NextResponse.json({ ok: true });
}
