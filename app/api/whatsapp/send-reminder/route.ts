import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { sendWhatsAppMessage, msgRentOverdue, msgRentDue, isWhatsAppReady } from "@/lib/whatsapp";
import { isEmailConfigured } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { isPro, planLimitResponse } from "@/lib/plan";

export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;

  if (!isPro(auth)) return planLimitResponse("Messaging requires a Pro plan.");

  // Need at least one channel. sendWhatsAppMessage mirrors to email, so an
  // email-configured deployment can still notify even when WhatsApp is down.
  if (!(await isWhatsAppReady()) && !isEmailConfigured()) {
    return NextResponse.json({ error: "No notification channel configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { paymentId, type } = body;

  if (typeof paymentId !== "string") {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where:   { id: paymentId, userId },
    include: { tenant: true, room: true },
  });

  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (!payment.tenant.phone) return NextResponse.json({ error: "Tenant has no phone number" }, { status: 400 });
  if (!payment.tenant.whatsappNotify) return NextResponse.json({ error: "Tenant has WhatsApp notifications disabled" }, { status: 400 });

  const settings = await getSettings(userId);
  const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);
  const balance  = payment.amountDue - payment.amountPaid;

  const [dueTpl, overdueTpl] = await Promise.all([
    prisma.setting.findUnique({ where: { userId_key: { userId, key: "wa_tpl_rent_due" } } }),
    prisma.setting.findUnique({ where: { userId_key: { userId, key: "wa_tpl_rent_overdue" } } }),
  ]);

  const msg = type === "overdue"
    ? msgRentOverdue(payment.tenant.name, fmt(balance), formatMonth(payment.month), payment.room.name, overdueTpl?.value)
    : msgRentDue(payment.tenant.name, fmt(payment.amountDue), formatMonth(payment.month), payment.room.name, dueTpl?.value);

  // Send over both channels. skipEmailMirror avoids a double email since we
  // send the email explicitly here. Succeed if either channel delivers.
  const { sendEmail, whatsappToHtml } = await import("@/lib/email");
  const waReady = await isWhatsAppReady();
  const subjectLine = msg.split("\n")[0].replace(/[*_]/g, "").trim();
  const [waSent, emailSent] = await Promise.all([
    waReady ? sendWhatsAppMessage(payment.tenant.phone, msg, { skipEmailMirror: true }).catch(() => false) : Promise.resolve(false),
    payment.tenant.email
      ? sendEmail(payment.tenant.email, `EasyRent: ${subjectLine.slice(0, 90)}`, whatsappToHtml(msg), msg).catch(() => false)
      : Promise.resolve(false),
  ]);
  if (!waSent && !emailSent) return NextResponse.json({ error: "Failed to send message" }, { status: 500 });

  return NextResponse.json({ ok: true, channels: { whatsapp: waSent, email: emailSent } });
}
