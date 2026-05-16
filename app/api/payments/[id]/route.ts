import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { sendWhatsAppMessage, msgPaymentReceived, isWhatsAppReady } from "@/lib/whatsapp";
import { isPro } from "@/lib/plan";
import { formatCurrency, formatMonth, formatRentalPeriod, PAYMENT_METHODS } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id, userId },
    include: { tenant: true, room: true },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payment);
}

function resolveStatus(paid: number, due: number, wasOverdue: boolean): string {
  if (paid >= due) return "PAID";
  if (paid > 0)   return "PARTIAL";
  return wasOverdue ? "OVERDUE" : "PENDING";
}

// DELETE = void/reverse a payment back to unpaid state
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
  const current = await prisma.payment.findUnique({ where: { id, userId } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const isPast = current.month < currentMonth;

  // Sum any credit that was generated in transactions for this payment (to restore it)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txns = await (prisma as any).paymentTransaction.findMany({
    where:  { paymentId: id },
    select: { creditAmount: true },
  }) as { creditAmount: number }[];
  const creditToRestore = txns.reduce((s, t) => s + (t.creditAmount ?? 0), 0);

  // Delete all transaction history for this payment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).paymentTransaction.deleteMany({ where: { paymentId: id } });

  // Restore credit balance (only as much as currently exists — can't go negative)
  if (creditToRestore > 0) {
    const tenant = await prisma.tenant.findUnique({ where: { id: current.tenantId }, select: { creditBalance: true } });
    const restore = Math.min(creditToRestore, tenant?.creditBalance ?? 0);
    if (restore > 0) {
      await prisma.tenant.update({ where: { id: current.tenantId }, data: { creditBalance: { decrement: restore } } });
    }
  }

  // Also reverse any charge payments that were part of this same session
  if (current.paidDate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chargeTxns = await (prisma as any).chargeTransaction.findMany({
      where: { userId, tenantId: current.tenantId, paidAt: current.paidDate },
    }) as { id: string; chargeId: string; amount: number }[];

    for (const ct of chargeTxns) {
      const charge = await prisma.oneTimeCharge.findUnique({
        where: { id: ct.chargeId },
        select: { amount: true, amountPaid: true },
      });
      if (charge) {
        const newPaid = Math.max(0, charge.amountPaid - ct.amount);
        await prisma.oneTimeCharge.update({
          where: { id: ct.chargeId },
          data: {
            amountPaid: newPaid,
            status:     newPaid <= 0 ? "PENDING" : newPaid >= charge.amount ? "PAID" : "PARTIAL",
          },
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).chargeTransaction.deleteMany({
      where: { userId, tenantId: current.tenantId, paidAt: current.paidDate },
    });
  }

  const payment = await prisma.payment.update({
    where: { id, userId },
    data:  {
      amountPaid: 0,
      method:     null,
      paidDate:   null,
      notes:      null,
      status:     isPast ? "OVERDUE" : "PENDING",
    },
  });
  return NextResponse.json(payment);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;
  const body = await req.json();

  const current = await prisma.payment.findUnique({ where: { id, userId } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalEntered = Number(body.amountPaid);
  if (!Number.isFinite(totalEntered) || totalEntered <= 0) {
    return NextResponse.json({ error: "amountPaid must be a positive number" }, { status: 400 });
  }
  if (body.method && !PAYMENT_METHODS.includes(body.method as typeof PAYMENT_METHODS[number])) {
    return NextResponse.json({ error: `method must be one of: ${PAYMENT_METHODS.join(", ")}` }, { status: 400 });
  }

  const txPaidAt = body.paidDate && !isNaN(new Date(body.paidDate).getTime())
    ? new Date(body.paidDate)
    : new Date();

  let remaining = totalEntered;

  // ── One-time charges (applied first if requested) ────────────────────────
  const appliedCharges: { title: string; amount: number; full: boolean }[] = [];
  if (body.applyToOneTimeCharges) {
    const unpaidCharges = await prisma.oneTimeCharge.findMany({
      where: { userId, tenantId: current.tenantId, status: { not: "PAID" } },
      orderBy: { date: "asc" },
    });
    for (const c of unpaidCharges) {
      if (remaining <= 0) break;
      const balance = c.amount - c.amountPaid;
      if (balance <= 0) continue;
      const apply   = Math.min(remaining, balance);
      remaining    -= apply;
      const newPaid = c.amountPaid + apply;
      await prisma.oneTimeCharge.update({
        where: { id: c.id },
        data: { amountPaid: newPaid, status: newPaid >= c.amount ? "PAID" : "PARTIAL" },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).chargeTransaction.create({
        data: {
          userId,
          tenantId:    current.tenantId,
          chargeId:    c.id,
          chargeTitle: c.title,
          amount:      apply,
          method:      body.method || null,
          paidAt:      txPaidAt,
          note:        body.notes || null,
        },
      });
      appliedCharges.push({ title: c.title, amount: apply, full: newPaid >= c.amount });
    }
  }

  // ── Payment distribution ─────────────────────────────────────────────────
  // Rules:
  //  • Always fully apply to the initiating payment (even partial).
  //  • Only cascade to OTHER unpaid months if remaining >= that month's full balance.
  //    This prevents a small overpayment (e.g. रू100 extra) from creating a confusing
  //    PARTIAL status on the next month — it goes to credit instead.

  const allUnpaid = await prisma.payment.findMany({
    where: { userId, tenantId: current.tenantId, status: { not: "PAID" } },
    orderBy: { month: "asc" },
  });

  // Collect updates without applying yet (need credit total first)
  const updates: { paymentId: string; month: string; amountDue: number; apply: number; newPaid: number; newStatus: string }[] = [];

  for (const p of allUnpaid) {
    if (remaining <= 0) break;
    const balance = p.amountDue - p.amountPaid;
    if (balance <= 0) continue;

    // For non-initiating months: only cascade if we can cover the full balance
    if (p.id !== id && remaining < balance) break;

    const apply   = Math.min(remaining, balance);
    remaining    -= apply;
    updates.push({
      paymentId: p.id,
      month:     p.month,
      amountDue: p.amountDue,
      apply,
      newPaid:   p.amountPaid + apply,
      newStatus: resolveStatus(p.amountPaid + apply, p.amountDue, p.status === "OVERDUE"),
    });
  }

  // Apply payment updates
  for (const u of updates) {
    await prisma.payment.update({
      where: { id: u.paymentId },
      data: {
        amountPaid: u.newPaid,
        status:     u.newStatus,
        method:     body.method || null,
        paidDate:   txPaidAt,
        ...(u.paymentId === id ? { notes: body.notes || null } : {}),
      },
    });
  }

  // Any remaining goes to credit balance
  let creditGenerated = 0;
  if (remaining > 0) {
    creditGenerated = remaining;
    await prisma.tenant.update({
      where: { id: current.tenantId },
      data:  { creditBalance: { increment: remaining } },
    });
  }

  // Create transaction records — creditAmount is only set on the initiating payment
  for (const u of updates) {
    const isInitiating = u.paymentId === id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).paymentTransaction.create({
      data: {
        userId,
        paymentId:    u.paymentId,
        amount:       u.apply,
        creditAmount: isInitiating ? creditGenerated : 0,
        totalEntered: isInitiating ? totalEntered : 0,
        method:       body.method || null,
        paidAt:       txPaidAt,
        note:         isInitiating ? (body.notes || null) : null,
      },
    });
  }

  const updated = await prisma.payment.findUnique({
    where: { id, userId },
    include: { tenant: true, room: true },
  });

  if (isPro(auth) && updated && await isWhatsAppReady() && updated.tenant.phone && updated.amountPaid > 0 && updated.tenant.whatsappNotify) {
    const settings = await getSettings(userId);
    const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);
    const tplRow   = await prisma.setting.findUnique({ where: { userId_key: { userId, key: "wa_tpl_payment_received" } } });

    // Build receipt deep-link if tenant has portal access
    let receiptUrl: string | undefined;
    if (updated.tenant.portalEnabled && updated.tenant.portalToken) {
      const proto    = req.headers.get("x-forwarded-proto") ?? "https";
      const host     = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
      const redirect = encodeURIComponent(`/portal/payments/${id}/receipt`);
      receiptUrl     = `${proto}://${host}/portal/t/${updated.tenant.portalToken}?redirect=${redirect}`;
    }

    // Build breakdown: one-time charges first, then rent months, then credit
    const moveInDay = updated.tenant.moveInDate ? new Date(updated.tenant.moveInDate).getDate() : 1;
    const breakdownLines: string[] = [];
    for (const c of appliedCharges) {
      breakdownLines.push(c.full ? `✅ ${c.title} — ${fmt(c.amount)}` : `🔸 ${c.title} — ${fmt(c.amount)} (partial)`);
    }
    for (const u of updates) {
      const label = formatRentalPeriod(u.month, moveInDay);
      if (u.newStatus === "PAID") {
        breakdownLines.push(`✅ ${label} — Fully paid`);
      } else {
        const bal = u.amountDue - u.newPaid;
        breakdownLines.push(`🔸 ${label} — ${fmt(u.apply)} paid (${fmt(bal)} remaining)`);
      }
    }
    if (creditGenerated > 0) {
      breakdownLines.push(`💳 Credit added: ${fmt(creditGenerated)}`);
    }

    const msg = msgPaymentReceived(
      updated.tenant.name,
      fmt(totalEntered),
      formatMonth(updated.month),
      updated.room.name,
      tplRow?.value,
      receiptUrl,
      breakdownLines,
    );
    sendWhatsAppMessage(updated.tenant.phone, msg).catch(err => console.error("[payments] Failed to send WhatsApp notification:", err));
  }

  return NextResponse.json(updated);
}
