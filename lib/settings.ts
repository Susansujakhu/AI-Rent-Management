import { prisma } from "@/lib/prisma";
import { cache } from "react";

export type AppSettings = {
  currencySymbol: string;
  currencyCode:   string;
};

const DEFAULTS: AppSettings = {
  currencySymbol: "रू",
  currencyCode:   "NPR",
};

// Per-request cached (React cache) — each user's request gets its own result
export const getSettings = cache(async (userId: string): Promise<AppSettings> => {
  const rows = await prisma.setting.findMany({ where: { userId } });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    currencySymbol: map["currency_symbol"] ?? DEFAULTS.currencySymbol,
    currencyCode:   map["currency_code"]   ?? DEFAULTS.currencyCode,
  };
});
