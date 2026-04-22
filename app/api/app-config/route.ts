import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.globalSetting.findMany({
    where: { key: { in: ["beta_mode", "admin_whatsapp"] } },
  });
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return NextResponse.json({
    betaMode:       result["beta_mode"]       !== "false",
    adminWhatsapp:  result["admin_whatsapp"]  ?? "",
  });
}
