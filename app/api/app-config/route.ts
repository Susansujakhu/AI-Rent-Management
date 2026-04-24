import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Use raw SQL so this works even if the Prisma client predates the GlobalSetting model
    const rows = await prisma.$queryRaw<{ key: string; value: string }[]>`
      SELECT \`key\`, \`value\` FROM \`GlobalSetting\`
      WHERE \`key\` IN ('beta_mode', 'admin_whatsapp')
    `;
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return NextResponse.json({
      betaMode:      result["beta_mode"]      !== "false",
      adminWhatsapp: result["admin_whatsapp"] ?? "",
    });
  } catch {
    return NextResponse.json({ betaMode: true, adminWhatsapp: "" });
  }
}
