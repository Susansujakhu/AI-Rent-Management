import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { requireAuthAPI } from "@/lib/auth";
import { isPro, planLimitResponse } from "@/lib/plan";

function csvCell(value: string | number): string {
  const s = String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;

  if (!isPro(auth)) return planLimitResponse("Report export requires a Pro plan.");

  const { searchParams } = new URL(req.url);
  const type      = searchParams.get("type") ?? "summary";
  const yearParam = searchParams.get("year");
  const year      = yearParam ? parseInt(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year must be a valid 4-digit year" }, { status: 400 });
  }

  const settings = await getSettings(userId);
  const sym      = settings.currencySymbol;

  // ── Tenants export ──────────────────────────────────────────────────────────
  if (type === "tenants") {
    const tenants = await prisma.tenant.findMany({
      where:   { userId },
      include: { room: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    const header = ["Name", "Phone", "Email", "Room", "Move-in Date", "Move-out Date", `Deposit (${sym})`, `Credit Balance (${sym})`, "Status"].map(csvCell).join(",");
    const rows   = tenants.map(t => [
      t.name, t.phone, t.email ?? "", t.room?.name ?? "",
      t.moveInDate.toLocaleDateString("en"),
      t.moveOutDate ? t.moveOutDate.toLocaleDateString("en") : "",
      t.deposit, t.creditBalance,
      t.moveOutDate ? "Moved Out" : "Active",
    ].map(csvCell).join(","));
    return new NextResponse([header, ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="tenants-${year}.csv"`,
      },
    });
  }

  // ── Payments export ─────────────────────────────────────────────────────────
  if (type === "payments") {
    const payments = await prisma.payment.findMany({
      where:   { userId, month: { gte: `${year}-01`, lte: `${year}-12` } },
      include: { tenant: { select: { name: true } }, room: { select: { name: true } } },
      orderBy: [{ month: "desc" }, { tenant: { name: "asc" } }],
    });
    const header = ["Month", "Tenant", "Room", `Rent Due (${sym})`, `Paid (${sym})`, `Balance (${sym})`, "Status", "Paid Date", "Method"].map(csvCell).join(",");
    const rows   = payments.map(p => [
      p.month, p.tenant.name, p.room.name,
      p.amountDue, p.amountPaid, p.amountDue - p.amountPaid,
      p.status,
      p.paidDate ? p.paidDate.toLocaleDateString("en") : "",
      p.method ?? "",
    ].map(csvCell).join(","));
    return new NextResponse([header, ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="payments-${year}.csv"`,
      },
    });
  }

  // ── Expenses export ─────────────────────────────────────────────────────────
  if (type === "expenses") {
    const expenses = await prisma.expense.findMany({
      where:   { userId, date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
      include: { room: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
    const header = ["Date", "Title", "Category", `Amount (${sym})`, "Room", "Description"].map(csvCell).join(",");
    const rows   = expenses.map(e => [
      e.date.toLocaleDateString("en"), e.title, e.category,
      e.amount, e.room?.name ?? "", e.description ?? "",
    ].map(csvCell).join(","));
    return new NextResponse([header, ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="expenses-${year}.csv"`,
      },
    });
  }

  // ── Summary report (default) ────────────────────────────────────────────────
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) months.push(`${year}-${String(m).padStart(2, "0")}`);

  const [payments, expenses, oneTimeCharges] = await Promise.all([
    prisma.payment.findMany({ where: { userId, month: { gte: `${year}-01`, lte: `${year}-12` } } }),
    prisma.expense.findMany({ where: { userId, date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } }),
    prisma.oneTimeCharge.findMany({ where: { userId, date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } }),
  ]);

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
    return [label(m), due, col, rate, exp, col - exp].map(csvCell).join(",");
  });

  const header = ["Month", `Rent Due (${sym})`, `Collected (${sym})`, "Collection Rate", `Expenses (${sym})`, `Net Income (${sym})`].map(csvCell).join(",");
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="rent-report-${year}.csv"`,
    },
  });
}
