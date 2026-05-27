import { NextResponse } from "next/server";
import { requireTenantAPIByToken } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { compressImage } from "@/lib/compress-image";

const VALID_METHODS = ["eSewa", "Khalti", "FonePay", "Bank", "Cash", "Other"];
const CLAIM_DIR = join(process.cwd(), "storage", "payment-claims");

// GET — the tenant's own claims, so the portal can show an "awaiting
// confirmation" banner after they report.
export async function GET(req: Request) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const claims = await prisma.paymentClaim.findMany({
    where:   { tenantId: tenant!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, paymentId: true, amount: true, method: true,
      reference: true, paidDate: true, note: true, status: true,
      screenshotPath: true, createdAt: true,
    },
  });

  return NextResponse.json(claims);
}

// POST (multipart/form-data) — tenant reports a payment made outside the app.
// This is a CLAIM only; it never marks bills paid. Accepts an optional
// proof-of-payment screenshot. The owner verifies + records it.
export async function POST(req: Request) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const t = tenant!;

  if (!checkRateLimit(`payment-claim:${t.id}`, 8, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many reports. Please wait a while before reporting again." }, { status: 429 });
  }

  const form = await req.formData();
  const amount    = Number(form.get("amount"));
  const methodRaw = String(form.get("method") ?? "");
  const reference = String(form.get("reference") ?? "").trim();
  const note      = String(form.get("note") ?? "").trim();
  const paidDateRaw = String(form.get("paidDate") ?? "");
  const oldestUnpaidId = String(form.get("oldestUnpaidId") ?? "").trim();
  const file = form.get("screenshot") as File | null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }
  const method   = VALID_METHODS.includes(methodRaw) ? methodRaw : "Other";
  const paidDate = paidDateRaw ? new Date(paidDateRaw) : new Date();
  if (Number.isNaN(paidDate.getTime())) {
    return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
  }

  // One pending report at a time per tenant — keeps the owner's queue clean.
  const existingPending = await prisma.paymentClaim.findFirst({
    where:  { tenantId: t.id, status: "pending" },
    select: { id: true },
  });
  if (existingPending) {
    return NextResponse.json({ error: "You already have a payment report awaiting confirmation." }, { status: 409 });
  }

  // Link the claim to the oldest unpaid bill (if valid) so the owner's
  // "Record payment" lands on the right starting bill, where the amount
  // cascades across months naturally.
  let paymentId: string | null = null;
  if (oldestUnpaidId) {
    const owned = await prisma.payment.findFirst({
      where:  { id: oldestUnpaidId, tenantId: t.id },
      select: { id: true },
    });
    if (owned) paymentId = owned.id;
  }

  const claim = await prisma.paymentClaim.create({
    data: {
      userId:    t.userId,
      tenantId:  t.id,
      paymentId,
      amount,
      method,
      reference: reference || null,
      paidDate,
      note:      note || null,
      status:    "pending",
    },
  });

  // Optional screenshot — compress + store, then save the filename.
  if (file && typeof file.arrayBuffer === "function" && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      // Non-fatal: keep the claim, just skip the bad file.
      console.warn("[payment-claim] screenshot rejected — not an image");
    } else if (file.size > 5 * 1024 * 1024) {
      console.warn("[payment-claim] screenshot rejected — over 5 MB");
    } else {
      try {
        await mkdir(CLAIM_DIR, { recursive: true });
        const buffer = Buffer.from(await file.arrayBuffer());
        const { buffer: compressed } = await compressImage(buffer, file.type);
        const filename = `${claim.id}.jpg`;
        await writeFile(join(CLAIM_DIR, filename), compressed);
        await prisma.paymentClaim.update({ where: { id: claim.id }, data: { screenshotPath: filename } });
      } catch (err) {
        console.error("[payment-claim] screenshot save failed:", err);
      }
    }
  }

  // ── Notify the owner: in-app notification + WhatsApp (best effort) ──────────
  const { formatCurrency } = await import("@/lib/utils");
  const { getSettings }    = await import("@/lib/settings");
  const settings  = await getSettings(t.userId).catch(() => null);
  const sym       = settings?.currencySymbol ?? "रू";
  const amountStr = formatCurrency(amount, sym);
  const dateStr   = paidDate.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
  const refStr    = reference ? ` (ref: ${reference})` : "";

  // createNotification mirrors this to the owner's WhatsApp automatically.
  await createNotification(
    t.userId,
    "payment_claim_submitted",
    `💰 ${t.name} reported a payment`,
    `${t.name} says they paid ${amountStr} via ${method} on ${dateStr}${refStr}. Verify it arrived, then record it in EasyRent.`,
    { tenantId: t.id, claimId: claim.id, paymentId },
  ).catch(() => null);

  return NextResponse.json({ ok: true, id: claim.id }, { status: 201 });
}
