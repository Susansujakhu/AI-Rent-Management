import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { sendWhatsAppMessage, msgPaymentReceived, isWhatsAppReady } from "@/lib/whatsapp";
import { isEmailConfigured } from "@/lib/email";
import { isPro } from "@/lib/plan";
import { formatCurrency, formatRentalPeriod } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;
  const { id } = await params;

  if (!isPro(auth)) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  if (!(await isWhatsAppReady()) && !isEmailConfigured()) {
    return NextResponse.json({ error: "No notification channel configured" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id, userId },
    include: { tenant: true, room: true },
  });

  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!payment.tenant.phone) return NextResponse.json({ error: "Tenant has no phone number" }, { status: 400 });
  if (!payment.tenant.whatsappNotify) return NextResponse.json({ error: "Tenant has WhatsApp notifications disabled" }, { status: 400 });
  if (payment.amountPaid <= 0) return NextResponse.json({ error: "Payment has no amount paid" }, { status: 400 });

  const settings = await getSettings(userId);
  const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);

  // ── Find the latest session this payment was paid in ────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentTxns = await (prisma as any).paymentTransaction.findMany({
    where:   { paymentId: id },
    orderBy: { paidAt: "desc" },
    select:  { amount: true, creditAmount: true, totalEntered: true, paidAt: true },
  }) as Array<{ amount: number; creditAmount: number; totalEntered: number; paidAt: Date }>;

  const latestTxn = paymentTxns[0];

  // ── Charge transactions in the same session ──────────────────────────────────
  type ChargeTxn = { chargeTitle: string; amount: number };
  let chargeTxns: ChargeTxn[] = [];
  let sessionTotal = payment.amountPaid;

  if (latestTxn) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chargeTxns = await (prisma as any).chargeTransaction.findMany({
      where:   { userId, tenantId: payment.tenantId, paidAt: latestTxn.paidAt },
      select:  { chargeTitle: true, amount: true },
      orderBy: { createdAt: "asc" },
    }) as ChargeTxn[];

    const chargesTotal = chargeTxns.reduce((s, c) => s + c.amount, 0);
    sessionTotal = (latestTxn.totalEntered > 0)
      ? latestTxn.totalEntered
      : latestTxn.amount + (latestTxn.creditAmount ?? 0) + chargesTotal;
  }

  // ── Build breakdown lines ───────────────────────────────────────────────────
  const moveInDay = payment.tenant.moveInDate ? new Date(payment.tenant.moveInDate).getDate() : 1;
  const breakdownLines: string[] = [];

  if (chargeTxns.length > 0) {
    // Include rent line
    breakdownLines.push(`• Rent (${formatRentalPeriod(payment.month, moveInDay)}): ${fmt(payment.amountPaid)}`);
    // Include each charge
    for (const c of chargeTxns) {
      breakdownLines.push(`• ${c.chargeTitle}: ${fmt(c.amount)}`);
    }
  }

  const tplRow = await prisma.setting.findUnique({ where: { userId_key: { userId, key: "wa_tpl_payment_received" } } });

  // Note: receiptUrl intentionally omitted — portal links are not sent in development
  const msg = msgPaymentReceived(
    payment.tenant.name,
    fmt(sessionTotal),
    formatRentalPeriod(payment.month, moveInDay),
    payment.room.name,
    tplRow?.value,
    undefined,       // no receipt URL
    breakdownLines.length > 0 ? breakdownLines : undefined,
  );

  // Both channels: WhatsApp (with skipEmailMirror) + explicit email. Succeed if
  // either delivers, so a down Baileys session still gets the receipt out.
  const { sendEmail, whatsappToHtml } = await import("@/lib/email");
  const waReady = await isWhatsAppReady();
  const subjectLine = msg.split("\n")[0].replace(/[*_]/g, "").trim();
  const [waSent, emailSent] = await Promise.all([
    waReady ? sendWhatsAppMessage(payment.tenant.phone, msg, { skipEmailMirror: true }).catch(() => false) : Promise.resolve(false),
    payment.tenant.email
      ? sendEmail(payment.tenant.email, `EasyRent: ${subjectLine.slice(0, 90)}`, whatsappToHtml(msg), msg).catch(() => false)
      : Promise.resolve(false),
  ]);
  if (!waSent && !emailSent) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  return NextResponse.json({ success: true, channels: { whatsapp: waSent, email: emailSent } });
}
