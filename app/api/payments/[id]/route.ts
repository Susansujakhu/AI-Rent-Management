import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { sendWhatsAppMessage, msgPaymentReceived, getWAStatus } from "@/lib/whatsapp";
import { formatCurrency, formatMonth, PAYMENT_METHODS } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
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
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const current = await prisma.payment.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const isPast = current.month < currentMonth;

  const payment = await prisma.payment.update({
    where: { id },
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
  const unauth = await requireAuthAPI(); if (unauth) return unauth;
  const { id } = await params;
  const body = await req.json();

  const current = await prisma.payment.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalEntered = Number(body.amountPaid);
  if (!Number.isFinite(totalEntered) || totalEntered <= 0) {
    return NextResponse.json({ error: "amountPaid must be a positive number" }, { status: 400 });
  }
  if (body.method && !PAYMENT_METHODS.includes(body.method as typeof PAYMENT_METHODS[number])) {
    return NextResponse.json({ error: `method must be one of: ${PAYMENT_METHODS.join(", ")}` }, { status: 400 });
  }

  const allUnpaid = await prisma.payment.findMany({
    where: {
      tenantId: current.tenantId,
      status:   { not: "PAID" },
    },
    orderBy: { month: "asc" },
  });

  let remaining = totalEntered;

  if (body.applyToOneTimeCharges) {
    const unpaidCharges = await prisma.oneTimeCharge.findMany({
      where: { tenantId: current.tenantId, status: { not: "PAID" } },
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
    }
  }

  for (const p of allUnpaid) {
    if (remaining <= 0) break;
    const balance = p.amountDue - p.amountPaid;
    if (balance <= 0) continue;

    const apply   = Math.min(remaining, balance);
    remaining    -= apply;
    const newPaid = p.amountPaid + apply;

    await prisma.payment.update({
      where: { id: p.id },
      data: {
        amountPaid: newPaid,
        status:     resolveStatus(newPaid, p.amountDue, p.status === "OVERDUE"),
        method:     body.method  || null,
        paidDate:   body.paidDate && !isNaN(new Date(body.paidDate).getTime())
                      ? new Date(body.paidDate)
                      : null,
        ...(p.id === id ? { notes: body.notes || null } : {}),
      },
    });
  }

  if (remaining > 0) {
    await prisma.tenant.update({
      where: { id: current.tenantId },
      data:  { creditBalance: { increment: remaining } },
    });
  }

  const updated = await prisma.payment.findUnique({
    where: { id },
    include: { tenant: true, room: true },
  });

  // Send WhatsApp confirmation if connected and tenant has notifications enabled
  if (updated && getWAStatus() === "ready" && updated.tenant.phone && updated.amountPaid > 0 && updated.tenant.whatsappNotify) {
    const settings = await getSettings();
    const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);
    // Load custom template if set
    const tplRow   = await prisma.setting.findUnique({ where: { key: "wa_tpl_payment_received" } });
    const msg      = msgPaymentReceived(
      updated.tenant.name,
      fmt(updated.amountPaid),
      formatMonth(updated.month),
      updated.room.name,
      tplRow?.value,
    );
    sendWhatsAppMessage(updated.tenant.phone, msg).catch(console.error);
  }

  return NextResponse.json(updated);
}
