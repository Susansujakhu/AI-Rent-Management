import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gs = (prisma as any).globalSetting;
    if (!gs) return NextResponse.json({ betaMode: false, adminWhatsapp: "" });
    const rows = await gs.findMany({
      where: { key: { in: ["beta_mode", "admin_whatsapp"] } },
    });
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return NextResponse.json({
      betaMode:      result["beta_mode"]      !== "false",
      adminWhatsapp: result["admin_whatsapp"] ?? "",
    });
  } catch {
    return NextResponse.json({ betaMode: false, adminWhatsapp: "" });
  }
}
