import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, getWAStatus, SYSTEM_WA_KEY } from "@/lib/whatsapp";
import { isPro } from "@/lib/plan";
import { checkRateLimit } from "@/lib/rate-limit";

// GET — return current upgrade request status
export async function GET() {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.user.findUnique as any)({
    where:  { id: auth.id },
    select: { plan: true, upgradeRequestedAt: true },
  }) as { plan: string; upgradeRequestedAt: Date | null } | null;

  return NextResponse.json({
    plan:               user?.plan ?? "free",
    isPro:              isPro(auth),
    upgradeRequestedAt: user?.upgradeRequestedAt ?? null,
  });
}

// POST — submit upgrade request
export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  if (isPro(auth)) {
    return NextResponse.json({ error: "You are already on Pro plan" }, { status: 400 });
  }

  // Rate limit: max 3 requests per user per hour
  if (!checkRateLimit(`upgrade-req:${auth.id}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429 });
  }

  const body          = await req.json().catch(() => ({})) as Record<string, unknown>;
  const message       = typeof body.message       === "string" ? body.message.trim().slice(0, 300)       : "";
  const paymentRef    = typeof body.paymentRef    === "string" ? body.paymentRef.trim().slice(0, 100)    : "";
  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod.trim().slice(0, 50)  : "";
  const billingCycle  = typeof body.billingCycle  === "string" ? body.billingCycle.trim()                : "";
  const planTier      = typeof body.plan          === "string" ? body.plan.trim()                        : "";
  const amount        = typeof body.amount        === "number" ? body.amount                             : null;

  // Save timestamp + requested plan details so admin can see what was requested
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.user.update as any)({
    where: { id: auth.id },
    data:  {
      upgradeRequestedAt:  new Date(),
      pendingPlan:         planTier         || null,
      pendingBillingCycle: billingCycle     || null,
    },
  });

  // Find admin to notify
  const admin = await prisma.user.findFirst({
    where:  { role: "admin" },
    select: { phone: true },
  });

  const waReady = getWAStatus(SYSTEM_WA_KEY) === "ready";
  let sent = false;

  if (waReady && admin?.phone) {
    const userName  = auth.name ?? auth.email;
    const userPhone = (auth as { phone?: string }).phone ?? "—";

    const amountLabel = amount
      ? `Rs. ${amount.toLocaleString()} (${billingCycle})`
      : billingCycle || "—";

    const msg = [
      `💰 *New Pro Upgrade Request*`,
      ``,
      `👤 *Name:* ${userName}`,
      `📧 *Email:* ${auth.email}`,
      `📱 *Phone:* ${userPhone}`,
      ``,
      `💳 *Payment Method:* ${paymentMethod || "—"}`,
      `📦 *Plan:* ${planTier ? planTier.charAt(0).toUpperCase() + planTier.slice(1) : "—"} — ${amountLabel}`,
      paymentRef ? `🔖 *Transaction ID:* ${paymentRef}` : `⚠️ *Transaction ID:* Not provided`,
      message   ? `💬 *Note:* ${message}` : null,
      ``,
      `Open the admin panel to verify and activate.`,
    ].filter(l => l !== null).join("\n");

    sent = await sendWhatsAppMessage(SYSTEM_WA_KEY, admin.phone, msg);
  }


  return NextResponse.json({ ok: true, sent });
}
