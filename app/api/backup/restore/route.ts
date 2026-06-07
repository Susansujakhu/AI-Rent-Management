import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

// 10 MB ceiling on backup payloads. Enough for thousands of payment rows,
// nowhere near enough to OOM the cPanel worker on a malicious request.
const MAX_BODY_BYTES = 10 * 1024 * 1024;

// Large restores must not trip Prisma's default 5s interactive-transaction
// timeout (row counts in the thousands on shared cPanel MySQL).
const TX_TIMEOUT_MS = 120_000;

type Row = Record<string, unknown>;
const str  = (v: unknown) => v as string;
const strN = (v: unknown) => (v as string | null) ?? null;
const num  = (v: unknown, d = 0) => (v === undefined || v === null ? d : Number(v));
const date = (v: unknown) => new Date(v as string);
const dateN = (v: unknown) => (v ? new Date(v as string) : null);

export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Backup file is too large (max 10 MB)." }, { status: 413 });
  }

  let backup: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Backup file is too large (max 10 MB)." }, { status: 413 });
    }
    backup = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
  }

  if (!backup.version || !backup.rooms || !backup.tenants || !backup.payments) {
    return NextResponse.json({ error: "Invalid backup file — missing required fields" }, { status: 400 });
  }

  const rooms               = (backup.rooms               as Row[]);
  const tenants             = (backup.tenants             as Row[]);
  const payments            = (backup.payments            as Row[]);
  const expenses            = (backup.expenses            as Row[]) ?? [];
  const recurringCharges    = (backup.recurringCharges    as Row[]) ?? [];
  const oneTimeCharges      = (backup.oneTimeCharges      as Row[]) ?? [];
  const paymentTransactions = (backup.paymentTransactions as Row[]) ?? [];
  const chargeTransactions  = (backup.chargeTransactions  as Row[]) ?? [];
  const settings            = (backup.settings            as Row[]) ?? [];
  // v4 additions — absent (and therefore lost) in v3 files
  const rentHistory         = (backup.rentHistory         as Row[]) ?? [];
  const meterReadings       = (backup.meterReadings       as Row[]) ?? [];
  const maintenanceRequests = (backup.maintenanceRequests as Row[]) ?? [];
  const paymentClaims       = (backup.paymentClaims       as Row[]) ?? [];
  const settlements         = (backup.settlements         as Row[]) ?? [];

  // FK referential sets — tolerate orphans in hand-edited/older files by
  // nulling optional FKs and skipping rows whose required parent is absent.
  const roomIds   = new Set(rooms.map(r => r.id as string));
  const tenantIds = new Set(tenants.map(t => t.id as string));
  const chargeIds = new Set(oneTimeCharges.map(c => c.id as string));
  const paymentIds = new Set(payments.map(p => p.id as string));

  try {
    await prisma.$transaction(async (tx) => {
      // Delete only the current user's data. Cascades clear the dependents
      // (rentHistory, meterReadings, claims, settlements, sessions, …).
      await tx.tenantSession.deleteMany({ where: { tenant: { userId } } });
      await tx.chargeTransaction.deleteMany({ where: { userId } });
      await tx.paymentTransaction.deleteMany({ where: { userId } });
      await tx.payment.deleteMany({ where: { userId } });
      await tx.oneTimeCharge.deleteMany({ where: { userId } });
      await tx.recurringCharge.deleteMany({ where: { userId } });
      await tx.expense.deleteMany({ where: { userId } });
      await tx.tenant.deleteMany({ where: { userId } });
      await tx.room.deleteMany({ where: { userId } });
      await tx.setting.deleteMany({ where: { userId } });
      await tx.rentHistory.deleteMany({ where: { userId } });

      await tx.room.createMany({ data: rooms.map(r => ({
        userId,
        id: str(r.id), name: str(r.name), floor: strN(r.floor),
        monthlyRent: num(r.monthlyRent), description: strN(r.description),
        createdAt: date(r.createdAt), updatedAt: date(r.updatedAt),
      })) });

      await tx.rentHistory.createMany({ data: rentHistory
        .filter(h => roomIds.has(h.roomId as string))
        .map(h => ({
          userId,
          id: str(h.id), roomId: str(h.roomId), amount: num(h.amount),
          effectiveFrom: str(h.effectiveFrom), reason: strN(h.reason),
          createdAt: date(h.createdAt),
        })) });

      // Tenants restore without portal tokens — links are no longer valid
      await tx.tenant.createMany({ data: tenants.map(t => ({
        userId,
        id: str(t.id), name: str(t.name), phone: str(t.phone), email: strN(t.email),
        roomId: t.roomId && roomIds.has(t.roomId as string) ? str(t.roomId) : null,
        moveInDate: date(t.moveInDate), moveOutDate: dateN(t.moveOutDate),
        deposit: num(t.deposit), creditBalance: num(t.creditBalance),
        notes: strN(t.notes), whatsappNotify: Boolean(t.whatsappNotify ?? true),
        portalEnabled: false, portalToken: null,
        createdAt: date(t.createdAt), updatedAt: date(t.updatedAt),
      })) });

      await tx.settlement.createMany({ data: settlements
        .filter(s => tenantIds.has(s.tenantId as string))
        .map(s => ({
          userId,
          id: str(s.id), tenantId: str(s.tenantId), moveOutDate: date(s.moveOutDate),
          totalDue: num(s.totalDue), creditApplied: num(s.creditApplied),
          depositHeld: num(s.depositHeld), depositApplied: num(s.depositApplied),
          refundDue: num(s.refundDue), balanceDue: num(s.balanceDue),
          detail: strN(s.detail), notes: strN(s.notes), createdAt: date(s.createdAt),
        })) });

      await tx.payment.createMany({ data: payments.map(p => ({
        userId,
        id: str(p.id), tenantId: str(p.tenantId), roomId: str(p.roomId),
        month: str(p.month), amountDue: num(p.amountDue), amountPaid: num(p.amountPaid),
        paidDate: dateN(p.paidDate), method: strN(p.method), status: str(p.status),
        notes: strN(p.notes), createdAt: date(p.createdAt), updatedAt: date(p.updatedAt),
      })) });

      await tx.paymentTransaction.createMany({ data: paymentTransactions.map(t => ({
        userId,
        id: str(t.id), paymentId: str(t.paymentId), amount: num(t.amount),
        creditAmount: num(t.creditAmount), totalEntered: num(t.totalEntered, num(t.amount)),
        method: strN(t.method), paidAt: date(t.paidAt), note: strN(t.note),
        createdAt: date(t.createdAt),
      })) });

      await tx.recurringCharge.createMany({ data: recurringCharges.map(c => ({
        userId,
        id: str(c.id), roomId: str(c.roomId), tenantId: strN(c.tenantId),
        title: str(c.title), amount: num(c.amount),
        effectiveFrom: strN(c.effectiveFrom), effectiveTo: strN(c.effectiveTo),
        createdAt: date(c.createdAt),
      })) });

      await tx.oneTimeCharge.createMany({ data: oneTimeCharges.map(c => ({
        userId,
        id: str(c.id), tenantId: str(c.tenantId), title: str(c.title),
        amount: num(c.amount), amountPaid: num(c.amountPaid), date: date(c.date),
        status: str(c.status), notes: strN(c.notes),
        createdAt: date(c.createdAt), updatedAt: date(c.updatedAt),
      })) });

      await tx.meterReading.createMany({ data: meterReadings
        .filter(m => tenantIds.has(m.tenantId as string))
        .map(m => ({
          userId,
          id: str(m.id), tenantId: str(m.tenantId), month: str(m.month),
          previous: num(m.previous), current: num(m.current),
          ratePerUnit: num(m.ratePerUnit), unitsUsed: num(m.unitsUsed), amount: num(m.amount),
          chargeId: m.chargeId && chargeIds.has(m.chargeId as string) ? str(m.chargeId) : null,
          photoPath: strN(m.photoPath), notes: strN(m.notes),
          submittedByTenant: Boolean(m.submittedByTenant ?? false),
          status: str(m.status ?? "confirmed"),
          createdAt: date(m.createdAt), updatedAt: date(m.updatedAt),
        })) });

      await tx.chargeTransaction.createMany({ data: chargeTransactions.map(t => ({
        userId,
        id: str(t.id), tenantId: str(t.tenantId), chargeId: str(t.chargeId),
        chargeTitle: str(t.chargeTitle), amount: num(t.amount), method: strN(t.method),
        paidAt: date(t.paidAt), note: strN(t.note), createdAt: date(t.createdAt),
      })) });

      await tx.paymentClaim.createMany({ data: paymentClaims
        .filter(c => tenantIds.has(c.tenantId as string))
        .map(c => ({
          userId,
          id: str(c.id), tenantId: str(c.tenantId),
          paymentId: c.paymentId && paymentIds.has(c.paymentId as string) ? str(c.paymentId) : null,
          amount: num(c.amount), method: str(c.method), reference: strN(c.reference),
          paidDate: date(c.paidDate), note: strN(c.note), screenshotPath: strN(c.screenshotPath),
          status: str(c.status ?? "pending"), reviewedAt: dateN(c.reviewedAt),
          createdAt: date(c.createdAt), updatedAt: date(c.updatedAt),
        })) });

      await tx.maintenanceRequest.createMany({ data: maintenanceRequests
        .filter(m => tenantIds.has(m.tenantId as string))
        .map(m => ({
          userId,
          id: str(m.id), tenantId: str(m.tenantId), title: str(m.title),
          description: strN(m.description), category: str(m.category ?? "OTHER"),
          priority: str(m.priority ?? "MEDIUM"), status: str(m.status ?? "OPEN"),
          notes: strN(m.notes), resolvedAt: dateN(m.resolvedAt),
          createdAt: date(m.createdAt), updatedAt: date(m.updatedAt),
        })) });

      await tx.expense.createMany({ data: expenses.map(e => ({
        userId,
        id: str(e.id), title: str(e.title), amount: num(e.amount), date: date(e.date),
        category: str(e.category ?? "OTHER"),
        roomId: e.roomId && roomIds.has(e.roomId as string) ? str(e.roomId) : null,
        description: strN(e.description),
        createdAt: date(e.createdAt), updatedAt: date(e.updatedAt),
      })) });

      // Restore settings (skip auth keys)
      const SKIP = new Set(["auth_email", "auth_password_hash", "session_token"]);
      await tx.setting.createMany({ data: settings
        .filter(s => !SKIP.has(s.key as string))
        .map(s => ({ userId, key: str(s.key), value: str(s.value) })) });
    }, { timeout: TX_TIMEOUT_MS });
  } catch (e) {
    console.error("Restore failed:", e);
    return NextResponse.json({ error: "Restore failed — no changes were applied (transaction rolled back)." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    restored: {
      rooms: rooms.length, tenants: tenants.length, payments: payments.length,
      rentHistory: rentHistory.length, meterReadings: meterReadings.length,
      settlements: settlements.length, maintenanceRequests: maintenanceRequests.length,
      paymentClaims: paymentClaims.length,
    },
  });
}
