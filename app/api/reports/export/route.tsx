import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { requireAuthAPI } from "@/lib/auth";
import { isPro, planLimitResponse } from "@/lib/plan";
import {
  SummaryDocument,
  PaymentsDocument,
  ExpensesDocument,
  TenantsDocument,
  renderPdf,
} from "@/lib/report-pdf";

export const runtime = "nodejs";

function pdfResponse(buf: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
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

  // Validate tenant/room belong to this user before honouring the filter.
  const tenantParam = searchParams.get("tenantId");
  const roomParam   = searchParams.get("roomId");
  const tenantOwned = tenantParam ? await prisma.tenant.findFirst({ where: { id: tenantParam, userId }, select: { id: true, name: true, roomId: true } }) : null;
  const roomOwned   = roomParam   ? await prisma.room.findFirst({   where: { id: roomParam,   userId }, select: { id: true, name: true              } }) : null;
  const tenantId    = tenantOwned?.id ?? null;
  const roomId      = roomOwned?.id   ?? null;
  // Expenses are room-scoped — when a tenant is selected, narrow expenses to
  // that tenant's current room. roomId takes precedence if both are set.
  const expenseRoomId = roomId ?? tenantOwned?.roomId ?? null;

  const slug = [tenantId ? "t" : null, roomId ? "r" : null].filter(Boolean).join("-");
  const namePart = slug ? `-${slug}` : "";

  const settings = await getSettings(userId);
  const sym      = settings.currencySymbol;
  const generated = new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });

  const filterParts: string[] = [];
  if (tenantOwned) filterParts.push(`Tenant: ${tenantOwned.name}`);
  if (roomOwned)   filterParts.push(`Room: ${roomOwned.name}`);
  const subtitleSuffix = filterParts.length ? `  ·  ${filterParts.join("  ·  ")}` : "";

  // ── Tenants export ──────────────────────────────────────────────────────────
  if (type === "tenants") {
    const tenants = await prisma.tenant.findMany({
      where:   { userId, ...(tenantId ? { id: tenantId } : {}), ...(roomId ? { roomId } : {}) },
      include: { room: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    const rows = tenants.map(t => ({
      name:    t.name,
      phone:   t.phone,
      email:   t.email ?? "",
      room:    t.room?.name ?? "",
      moveIn:  t.moveInDate.toLocaleDateString("en"),
      moveOut: t.moveOutDate ? t.moveOutDate.toLocaleDateString("en") : "",
      deposit: t.deposit,
      credit:  t.creditBalance,
      status:  t.moveOutDate ? "Moved Out" : "Active",
    }));
    const buf = await renderPdf(
      <TenantsDocument
        title="Tenants Report"
        subtitle={`${year}${subtitleSuffix}`}
        generated={generated}
        sym={sym}
        rows={rows}
      />,
    );
    return pdfResponse(buf, `tenants-${year}${namePart}`);
  }

  // ── Payments export ─────────────────────────────────────────────────────────
  if (type === "payments") {
    const payments = await prisma.payment.findMany({
      where:   { userId, month: { gte: `${year}-01`, lte: `${year}-12` }, ...(tenantId ? { tenantId } : {}), ...(roomId ? { roomId } : {}) },
      include: { tenant: { select: { name: true } }, room: { select: { name: true } } },
      orderBy: [{ month: "desc" }, { tenant: { name: "asc" } }],
    });
    const rows = payments.map(p => ({
      month:    p.month,
      tenant:   p.tenant.name,
      room:     p.room.name,
      due:      p.amountDue,
      paid:     p.amountPaid,
      balance:  p.amountDue - p.amountPaid,
      status:   p.status,
      paidDate: p.paidDate ? p.paidDate.toLocaleDateString("en") : "",
      method:   p.method ?? "",
    }));
    const buf = await renderPdf(
      <PaymentsDocument
        title="Payments Report"
        subtitle={`${year}${subtitleSuffix}`}
        generated={generated}
        sym={sym}
        rows={rows}
      />,
    );
    return pdfResponse(buf, `payments-${year}${namePart}`);
  }

  // ── Expenses export ─────────────────────────────────────────────────────────
  if (type === "expenses") {
    const expenses = await prisma.expense.findMany({
      where:   { userId, date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) }, ...(expenseRoomId ? { roomId: expenseRoomId } : {}) },
      include: { room: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
    const rows = expenses.map(e => ({
      date:        e.date.toLocaleDateString("en"),
      title:       e.title,
      category:    e.category,
      amount:      e.amount,
      room:        e.room?.name ?? "",
      description: e.description ?? "",
    }));
    const buf = await renderPdf(
      <ExpensesDocument
        title="Expenses Report"
        subtitle={`${year}${subtitleSuffix}`}
        generated={generated}
        sym={sym}
        rows={rows}
      />,
    );
    return pdfResponse(buf, `expenses-${year}${namePart}`);
  }

  // ── Summary report (default) ────────────────────────────────────────────────
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) months.push(`${year}-${String(m).padStart(2, "0")}`);

  const [payments, expenses, oneTimeCharges] = await Promise.all([
    prisma.payment.findMany({ where: { userId, month: { gte: `${year}-01`, lte: `${year}-12` }, ...(tenantId ? { tenantId } : {}), ...(roomId ? { roomId } : {}) } }),
    prisma.expense.findMany({ where: { userId, date:  { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) }, ...(expenseRoomId ? { roomId: expenseRoomId } : {}) } }),
    prisma.oneTimeCharge.findMany({ where: { userId, date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) }, ...(tenantId ? { tenantId } : {}) } }),
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
    return { month: label(m), due, col, rate, exp, net: col - exp };
  });

  const totals = rows.reduce(
    (a, r) => ({ due: a.due + r.due, col: a.col + r.col, exp: a.exp + r.exp, net: a.net + r.net }),
    { due: 0, col: 0, exp: 0, net: 0 },
  );

  const buf = await renderPdf(
    <SummaryDocument
      title="Rent Collection Summary"
      subtitle={`${year}${subtitleSuffix}`}
      generated={generated}
      sym={sym}
      rows={rows}
      totals={totals}
    />,
  );
  return pdfResponse(buf, `rent-report-${year}${namePart}`);
}
