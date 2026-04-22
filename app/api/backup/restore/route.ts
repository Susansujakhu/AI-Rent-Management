import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;

  let backup: Record<string, unknown>;
  try {
    backup = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
  }

  if (!backup.version || !backup.rooms || !backup.tenants || !backup.payments) {
    return NextResponse.json({ error: "Invalid backup file — missing required fields" }, { status: 400 });
  }

  const rooms               = backup.rooms               as Record<string, unknown>[];
  const tenants             = backup.tenants             as Record<string, unknown>[];
  const payments            = backup.payments            as Record<string, unknown>[];
  const expenses            = backup.expenses            as Record<string, unknown>[] ?? [];
  const recurringCharges    = backup.recurringCharges    as Record<string, unknown>[] ?? [];
  const oneTimeCharges      = backup.oneTimeCharges      as Record<string, unknown>[] ?? [];
  const paymentTransactions = backup.paymentTransactions as Record<string, unknown>[] ?? [];
  const settings            = backup.settings            as Record<string, unknown>[] ?? [];

  try {
    await prisma.$transaction(async (tx) => {
      // Delete only the current user's data in FK-safe order
      await tx.tenantSession.deleteMany({ where: { tenant: { userId } } });
      await tx.paymentTransaction.deleteMany({ where: { userId } });
      await tx.payment.deleteMany({ where: { userId } });
      await tx.oneTimeCharge.deleteMany({ where: { userId } });
      await tx.recurringCharge.deleteMany({ where: { userId } });
      await tx.expense.deleteMany({ where: { userId } });
      await tx.tenant.deleteMany({ where: { userId } });
      await tx.room.deleteMany({ where: { userId } });
      await tx.setting.deleteMany({ where: { userId } });

      // Restore rooms
      for (const r of rooms) {
        await tx.room.create({ data: {
          userId,
          id:          r.id          as string,
          name:        r.name        as string,
          floor:       r.floor       as string | null ?? null,
          monthlyRent: Number(r.monthlyRent),
          description: r.description as string | null ?? null,
          createdAt:   new Date(r.createdAt as string),
          updatedAt:   new Date(r.updatedAt as string),
        }});
      }

      // Restore tenants (without portalToken to avoid conflicts)
      for (const t of tenants) {
        await tx.tenant.create({ data: {
          userId,
          id:             t.id            as string,
          name:           t.name          as string,
          phone:          t.phone         as string,
          email:          t.email         as string | null ?? null,
          roomId:         t.roomId        as string | null ?? null,
          moveInDate:     new Date(t.moveInDate as string),
          moveOutDate:    t.moveOutDate ? new Date(t.moveOutDate as string) : null,
          deposit:        Number(t.deposit ?? 0),
          creditBalance:  Number(t.creditBalance ?? 0),
          notes:          t.notes         as string | null ?? null,
          whatsappNotify: Boolean(t.whatsappNotify ?? true),
          portalEnabled:  false,  // reset portal — links are no longer valid
          portalToken:    null,
          createdAt:      new Date(t.createdAt as string),
          updatedAt:      new Date(t.updatedAt as string),
        }});
      }

      // Restore payments
      for (const p of payments) {
        await tx.payment.create({ data: {
          userId,
          id:         p.id        as string,
          tenantId:   p.tenantId  as string,
          roomId:     p.roomId    as string,
          month:      p.month     as string,
          amountDue:  Number(p.amountDue),
          amountPaid: Number(p.amountPaid ?? 0),
          paidDate:   p.paidDate ? new Date(p.paidDate as string) : null,
          method:     p.method    as string | null ?? null,
          status:     p.status    as string,
          notes:      p.notes     as string | null ?? null,
          createdAt:  new Date(p.createdAt as string),
          updatedAt:  new Date(p.updatedAt as string),
        }});
      }

      // Restore payment transactions
      for (const t of paymentTransactions) {
        await tx.paymentTransaction.create({ data: {
          userId,
          id:           t.id           as string,
          paymentId:    t.paymentId    as string,
          amount:       Number(t.amount),
          creditAmount: Number(t.creditAmount ?? 0),
          totalEntered: Number(t.totalEntered ?? t.amount),
          method:       t.method       as string,
          paidAt:       new Date(t.paidAt as string),
          note:         t.note         as string | null ?? null,
          createdAt:    new Date(t.createdAt as string),
        }});
      }

      // Restore recurring charges
      for (const c of recurringCharges) {
        await tx.recurringCharge.create({ data: {
          userId,
          id:            c.id            as string,
          roomId:        c.roomId        as string,
          tenantId:      c.tenantId      as string | null ?? null,
          title:         c.title         as string,
          amount:        Number(c.amount),
          effectiveFrom: c.effectiveFrom as string | null ?? null,
          createdAt:     new Date(c.createdAt as string),
        }});
      }

      // Restore one-time charges
      for (const c of oneTimeCharges) {
        await tx.oneTimeCharge.create({ data: {
          userId,
          id:         c.id        as string,
          tenantId:   c.tenantId  as string,
          title:      c.title     as string,
          amount:     Number(c.amount),
          amountPaid: Number(c.amountPaid ?? 0),
          date:       new Date(c.date as string),
          status:     c.status    as string,
          notes:      c.notes     as string | null ?? null,
          createdAt:  new Date(c.createdAt as string),
          updatedAt:  new Date(c.updatedAt as string),
        }});
      }

      // Restore expenses
      for (const e of expenses) {
        await tx.expense.create({ data: {
          userId,
          id:          e.id          as string,
          title:       e.title       as string,
          amount:      Number(e.amount),
          date:        new Date(e.date as string),
          category:    e.category    as string ?? "OTHER",
          roomId:      e.roomId      as string | null ?? null,
          description: e.description as string | null ?? null,
          createdAt:   new Date(e.createdAt as string),
          updatedAt:   new Date(e.updatedAt as string),
        }});
      }

      // Restore settings (skip auth keys)
      const SKIP = new Set(["auth_email", "auth_password_hash", "session_token"]);
      for (const s of settings) {
        if (SKIP.has(s.key as string)) continue;
        await tx.setting.create({ data: {
          userId,
          key:   s.key   as string,
          value: s.value as string,
        }});
      }
    });
  } catch (e) {
    console.error("Restore failed:", e);
    return NextResponse.json({ error: "Restore failed — data may be partially restored. Check server logs." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, restored: { rooms: rooms.length, tenants: tenants.length, payments: payments.length } });
}
