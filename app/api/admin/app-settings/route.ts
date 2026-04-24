import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = new Set(["beta_mode", "admin_whatsapp"]);

export async function GET() {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.$queryRaw<{ key: string; value: string }[]>`
    SELECT \`key\`, \`value\` FROM \`GlobalSetting\`
  `;
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return NextResponse.json(result);
}

export async function PUT(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as Record<string, string>;
  const entries = Object.entries(body).filter(([k]) => ALLOWED_KEYS.has(k));
  if (entries.length === 0) return NextResponse.json({ error: "No valid keys" }, { status: 400 });

  await Promise.all(
    entries.map(([key, value]) =>
      prisma.$executeRaw`
        INSERT INTO \`GlobalSetting\` (\`key\`, \`value\`) VALUES (${key}, ${value})
        ON DUPLICATE KEY UPDATE \`value\` = ${value}
      `
    )
  );
  return NextResponse.json({ ok: true });
}
