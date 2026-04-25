import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const existing = await prisma.maintenanceRequest.findFirst({
    where: { id, userId: auth.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body                       = await req.json() as { status?: string; notes?: string };
  const { status, notes }          = body;
  const VALID_STATUSES             = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: {
      ...(status && VALID_STATUSES.includes(status) ? { status } : {}),
      ...(notes !== undefined ? { notes: notes.trim() || null } : {}),
      ...(status === "RESOLVED" && existing.status !== "RESOLVED" ? { resolvedAt: new Date() } : {}),
      ...(status && status !== "RESOLVED" && existing.status === "RESOLVED" ? { resolvedAt: null } : {}),
    },
    include: {
      tenant: {
        select: {
          id:   true,
          name: true,
          room: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const existing = await prisma.maintenanceRequest.findFirst({
    where: { id, userId: auth.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.maintenanceRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
