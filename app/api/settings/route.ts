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

const ALLOWED_SETTING_KEYS = new Set([
  // Property info
  "propertyName",
  "ownerName",
  "ownerPhone",
  "ownerAddress",
  // Currency (snake_case — matches what the settings page sends)
  "currency_symbol",
  "currency_code",
  // WhatsApp templates
  "wa_tpl_payment_received",
  "wa_tpl_rent_due",
  "wa_tpl_rent_overdue",
  // Auto reminder scheduler
  "auto_reminders_enabled",
  "reminder_hour",
]);

export async function PUT(request: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const body = await request.json() as Record<string, string>;

  const entries = Object.entries(body).filter(([key]) => ALLOWED_SETTING_KEYS.has(key));
  if (entries.length === 0) {
    return NextResponse.json({ error: "No valid settings keys provided" }, { status: 400 });
  }

  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
