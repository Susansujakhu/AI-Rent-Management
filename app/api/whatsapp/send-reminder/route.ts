import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { sendWhatsAppMessage, msgRentOverdue, msgRentDue, getWAStatus } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  const unauth = await requireAuthAPI();
  if (unauth) return unauth;

  if (getWAStatus() !== "ready") {
    return NextResponse.json({ error: "WhatsApp not connected" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { paymentId, type } = body;

  if (typeof paymentId !== "string") {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { tenant: true, room: true },
  });

  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (!payment.tenant.phone) return NextResponse.json({ error: "Tenant has no phone number" }, { status: 400 });
  if (!payment.tenant.whatsappNotify) return NextResponse.json({ error: "Tenant has WhatsApp notifications disabled" }, { status: 400 });

  const settings = await getSettings();
  const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);
  const balance  = payment.amountDue - payment.amountPaid;

  // Load custom templates
  const [dueTpl, overdueTpl] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "wa_tpl_rent_due" } }),
    prisma.setting.findUnique({ where: { key: "wa_tpl_rent_overdue" } }),
  ]);

  const msg = type === "overdue"
    ? msgRentOverdue(payment.tenant.name, fmt(balance), formatMonth(payment.month), payment.room.name, overdueTpl?.value)
    : msgRentDue(payment.tenant.name, fmt(payment.amountDue), formatMonth(payment.month), payment.room.name, dueTpl?.value);

  const sent = await sendWhatsAppMessage(payment.tenant.phone, msg);
  if (!sent) return NextResponse.json({ error: "Failed to send message" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
