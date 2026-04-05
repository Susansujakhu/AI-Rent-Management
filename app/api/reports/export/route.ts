import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const settings = await getSettings();
  const sym = settings.currencySymbol;

  const [payments, expenses, oneTimeCharges] = await Promise.all([
    prisma.payment.findMany({ where: { month: { gte: `${year}-01`, lte: `${year}-12` } } }),
    prisma.expense.findMany({ where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } }),
    prisma.oneTimeCharge.findMany({ where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } }),
  ]);

  const months: string[] = [];
  for (let m = 1; m <= 12; m++) months.push(`${year}-${String(m).padStart(2, "0")}`);

  const payByMonth: Record<string, { due: number; col: number }> = {};
  for (const p of payments) {
    if (!payByMonth[p.month]) payByMonth[p.month] = { due: 0, col: 0 };
    payByMonth[p.month].due += p.amountDue;
    payByMonth[p.month].col += p.amountPaid;
  }
  for (const c of oneTimeCharges) {
    const k = `${new Date(c.date).getFullYear()}-${String(new Date(c.date).getMonth() + 1).padStart(2, "0")}`;
    if (!payByMonth[k]) payByMonth[k] = { due: 0, col: 0 };
    payByMonth[k].due += c.amount;
    payByMonth[k].col += c.amountPaid;
  }
  const expByMonth: Record<string, number> = {};
  for (const e of expenses) {
    const k = `${new Date(e.date).getFullYear()}-${String(new Date(e.date).getMonth() + 1).padStart(2, "0")}`;
    expByMonth[k] = (expByMonth[k] || 0) + e.amount;
  }

  const label = (m: string) => new Date(parseInt(m.slice(0, 4)), parseInt(m.slice(5)) - 1).toLocaleDateString("en", { month: "long", year: "numeric" });

  const rows = months.map(m => {
    const due = payByMonth[m]?.due ?? 0;
    const col = payByMonth[m]?.col ?? 0;
    const exp = expByMonth[m] ?? 0;
    const rate = due > 0 ? `${Math.round((col / due) * 100)}%` : "—";
    return [label(m), due, col, rate, exp, col - exp].join(",");
  });

  const header = `Month,Rent Due (${sym}),Collected (${sym}),Collection Rate,Expenses (${sym}),Net Income (${sym})`;
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="rent-report-${year}.csv"`,
    },
  });
}
