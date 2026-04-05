import { prisma } from "@/lib/prisma";
import { cache } from "react";

export type AppSettings = {
  currencySymbol: string;
  currencyCode: string;
};

const DEFAULTS: AppSettings = {
  currencySymbol: "रू",
  currencyCode: "NPR",
};

export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    currencySymbol: map["currency_symbol"] ?? DEFAULTS.currencySymbol,
    currencyCode: map["currency_code"] ?? DEFAULTS.currencyCode,
  };
});
