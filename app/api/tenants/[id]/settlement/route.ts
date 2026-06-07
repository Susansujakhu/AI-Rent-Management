import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { isPro } from "@/lib/plan";
import { previewSettlement, executeSettlement, voidSettlement } from "@/lib/settlement";
import { sendWhatsAppMessage, isWhatsAppReady, BRAND_FOOTER } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";
import { formatCurrency } from "@/lib/utils";

// GET /api/tenants/[id]/settlement?date=YYYY-MM-DD → preview (no writes)
// GET without date → the recorded settlement (if any)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const url  = new URL(req.url);
  const date = url.searchParams.get("date");

  if (!date) {
    const settlement = await prisma.settlement.findFirst({ where: { tenantId: id, userId: auth.id } });
    if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(settlement);
  }

  const moveOutDate = new Date(date);
  if (isNaN(moveOutDate.getTime()))
    return NextResponse.json({ error: "date must be a valid date" }, { status: 400 });

  const preview = await previewSettlement(auth.id, id, moveOutDate);
  if ("error" in preview) return NextResponse.json(preview, { status: 400 });
  return NextResponse.json(preview);
}

// POST /api/tenants/[id]/settlement
// Body: { moveOutDate, deductions?: [{title, amount}], notes?, preview?: boolean }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthAPI();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body = await req.json();

    const moveOutDate = new Date(body.moveOutDate);
    if (isNaN(moveOutDate.getTime()))
      return NextResponse.json({ error: "moveOutDate must be a valid date" }, { status: 400 });

    const deductions = Array.isArray(body.deductions)
      ? body.deductions
          .map((d: { title?: unknown; amount?: unknown }) => ({
            title: typeof d.title === "string" ? d.title.slice(0, 255) : "",
            amount: Number(d.amount),
          }))
          .filter((d: { amount: number }) => Number.isFinite(d.amount) && d.amount > 0)
      : [];

    if (body.preview) {
      const preview = await previewSettlement(auth.id, id, moveOutDate, deductions);
      if ("error" in preview) return NextResponse.json(preview, { status: 400 });
      return NextResponse.json(preview);
    }

    if (typeof body.notes === "string" && body.notes.length > 5000)
      return NextResponse.json({ error: "notes must be 5000 characters or fewer" }, { status: 400 });

    const result = await executeSettlement(auth.id, id, {
      moveOutDate,
      deductions,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    if ("error" in result) return NextResponse.json(result, { status: 400 });

    // Notify tenant on WhatsApp (pro feature, fire-and-forget)
    notifyTenant(auth, id, result.settlement).catch(err =>
      console.error("[settlement] WhatsApp notify failed:", err));

    return NextResponse.json(result.settlement);
  } catch (e) {
    console.error("[settlement POST]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE /api/tenants/[id]/settlement → void the settlement and restore records
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthAPI();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const result = await voidSettlement(auth.id, id);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[settlement DELETE]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

async function notifyTenant(
  auth: Parameters<typeof isPro>[0] & { id: string },
  tenantId: string,
  settlement: { totalDue: number; creditApplied: number; depositHeld: number; depositApplied: number; refundDue: number; balanceDue: number; moveOutDate: Date },
) {
  if (!isPro(auth)) return;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId, userId: auth.id },
    include: { room: true },
  });
  if (!tenant?.phone || !tenant.whatsappNotify) return;
  if (!(await isWhatsAppReady())) return;

  const settings = await getSettings(auth.id);
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  const lines = [
    `Hi ${tenant.name}, here is your move-out settlement${tenant.room ? ` for ${tenant.room.name}` : ""}:`,
    ``,
    `Total dues: ${fmt(settlement.totalDue)}`,
  ];
  if (settlement.creditApplied > 0) lines.push(`Advance credit applied: ${fmt(settlement.creditApplied)}`);
  lines.push(`Security deposit held: ${fmt(settlement.depositHeld)}`);
  if (settlement.depositApplied > 0) lines.push(`Deposit applied to dues: ${fmt(settlement.depositApplied)}`);
  lines.push(``);
  if (settlement.refundDue > 0)   lines.push(`✅ Refund due to you: ${fmt(settlement.refundDue)}`);
  if (settlement.balanceDue > 0)  lines.push(`⚠️ Balance still due: ${fmt(settlement.balanceDue)}`);
  if (settlement.refundDue === 0 && settlement.balanceDue === 0) lines.push(`✅ Account fully settled — nothing due either way.`);
  lines.push(``, `Thank you for staying with us!`);

  await sendWhatsAppMessage(tenant.phone, lines.join("\n") + BRAND_FOOTER);
}
