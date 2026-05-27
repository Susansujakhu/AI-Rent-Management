import { NextResponse } from "next/server";
import { requireTenantAPIByToken } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";

const VALID_METHODS = ["eSewa", "Khalti", "FonePay", "Bank", "Cash", "Other"];

// GET — the tenant's own claims, so the portal can show "awaiting confirmation"
// badges next to the bills they've reported.
export async function GET(req: Request) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const claims = await prisma.paymentClaim.findMany({
    where:   { tenantId: tenant!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, paymentId: true, amount: true, method: true,
      reference: true, paidDate: true, note: true, status: true, createdAt: true,
    },
  });

  return NextResponse.json(claims);
}

// POST — tenant reports a payment they made outside the app. This is a CLAIM
// only: it never marks the bill paid. It notifies the owner, who verifies the
// money arrived and records the payment through the normal flow.
export async function POST(req: Request) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const t = tenant!;

  // Light anti-spam: cap claims per tenant. Owners shouldn't get flooded.
  if (!checkRateLimit(`payment-claim:${t.id}`, 8, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many reports. Please wait a while before reporting again." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as {
    paymentId?: string;
    amount?:    number;
    method?:    string;
    reference?: string;
    paidDate?:  string;
    note?:      string;
  };

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }
  const method = VALID_METHODS.includes(body.method ?? "") ? body.method! : "Other";

  const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
  if (Number.isNaN(paidDate.getTime())) {
    return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
  }

  // If a bill was referenced, make sure it actually belongs to this tenant.
  let paymentId: string | null = null;
  if (body.paymentId) {
    const owned = await prisma.payment.findFirst({
      where:  { id: body.paymentId, tenantId: t.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }
    // Don't let duplicate pending claims pile up against the same bill.
    const existingPending = await prisma.paymentClaim.findFirst({
      where:  { tenantId: t.id, paymentId: body.paymentId, status: "pending" },
      select: { id: true },
    });
    if (existingPending) {
      return NextResponse.json({ error: "You've already reported a payment for this bill. It's awaiting confirmation." }, { status: 409 });
    }
    paymentId = body.paymentId;
  }

  const claim = await prisma.paymentClaim.create({
    data: {
      userId:    t.userId,
      tenantId:  t.id,
      paymentId,
      amount,
      method,
      reference: body.reference?.trim() || null,
      paidDate,
      note:      body.note?.trim() || null,
      status:    "pending",
    },
  });

  // ── Notify the owner: in-app notification + WhatsApp (best effort) ──────────
  const { formatCurrency } = await import("@/lib/utils");
  const { getSettings }    = await import("@/lib/settings");
  const settings = await getSettings(t.userId).catch(() => null);
  const sym      = settings?.currencySymbol ?? "रू";
  const amountStr = formatCurrency(amount, sym);
  const dateStr   = paidDate.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
  const refStr    = claim.reference ? ` (ref: ${claim.reference})` : "";

  await createNotification(
    t.userId,
    "payment_claim_submitted",
    `${t.name} reported a payment`,
    `${t.name} says they paid ${amountStr} via ${method} on ${dateStr}${refStr}. Verify it arrived, then record it.`,
    { tenantId: t.id, claimId: claim.id, paymentId },
  ).catch(() => null);

  // WhatsApp to the owner's own number (if configured + WhatsApp is ready).
  try {
    const owner = await prisma.user.findUnique({ where: { id: t.userId }, select: { phone: true } });
    if (owner?.phone) {
      const { sendWhatsAppMessage, isWhatsAppReady } = await import("@/lib/whatsapp");
      if (await isWhatsAppReady()) {
        const msg =
          `💰 *Payment reported*\n\n` +
          `${t.name} says they paid *${amountStr}* via ${method} on ${dateStr}${refStr}.\n\n` +
          `Please verify the money arrived, then record it in EasyRent.`;
        sendWhatsAppMessage(owner.phone, msg).catch(() => {});
      }
    }
  } catch { /* best effort — never block the claim on WhatsApp */ }

  return NextResponse.json(claim, { status: 201 });
}
