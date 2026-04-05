import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET() {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const rows = await prisma.setting.findMany();
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const body = await request.json() as Record<string, string>;
  await Promise.all(
    Object.entries(body).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
