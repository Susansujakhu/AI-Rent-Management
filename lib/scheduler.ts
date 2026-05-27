/**
 * Scheduler: runs inside the Next.js Node.js server process (instrumentation.ts).
 * Persists across hot-reloads via globalThis.
 *
 * Handles three jobs:
 *  1. Monthly payment generation — per-user, on 1st of month (catches up if server was down)
 *  2. Overdue rent reminders     — per-user, at user-configured hour, via user's WA session
 *  3. Subscription maintenance   — system-wide, once per day:
 *       a. Auto-downgrade expired paid plans to free
 *       b. Send 7-day and 1-day renewal reminder to users via System WA
 */

import { prisma } from "./prisma";
import { isWhatsAppReady, sendWhatsAppMessage, msgRentOverdue } from "./whatsapp";
import { formatCurrency, formatMonth } from "./utils";
import { isPro } from "./plan";
import type { AuthUser } from "./auth";

interface SchedulerGlobal {
  _schedulerTimer:          ReturnType<typeof setInterval> | undefined;
  _schedulerRunning:        boolean;
  _subMaintenanceLastDate:  string; // "YYYY-MM-DD" — in-memory dedup
}

const g = globalThis as typeof globalThis & SchedulerGlobal;

// ── 1. Monthly payment generation (per-user) ─────────────────────────────────

async function runMonthlyPaymentGeneration(): Promise<void> {
  const now        = new Date();
  const todayDay   = now.getDate();
  const month      = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Find tenants whose billing day is today.
  // Edge case: if move-in day > days in this month (e.g. moved in on 31st, Feb has 28),
  // generate on the last day of the month.
  const tenants = await prisma.tenant.findMany({
    where: {
      roomId:     { not: null },
      moveInDate: { not: undefined },
      OR: [{ moveOutDate: null }, { moveOutDate: { gte: monthStart } }],
    },
    include: { room: { include: { recurringCharges: true } } },
  });

  // Filter to tenants whose billing day falls today
  const due = tenants.filter(t => {
    const moveInDay = new Date(t.moveInDate!).getDate();
    if (moveInDay === todayDay) return true;
    // Last day of month covers tenants whose moveInDay doesn't exist this month
    if (todayDay === daysInMonth && moveInDay > daysInMonth) return true;
    return false;
  });

  if (due.length === 0) return;

  // Check which already have a payment this month
  const existing = await prisma.payment.findMany({
    where: { tenantId: { in: due.map(t => t.id) }, month },
    select: { tenantId: true },
  });
  const existingSet = new Set(existing.map(p => p.tenantId));

  let created = 0;
  for (const tenant of due) {
    if (!tenant.roomId || !tenant.room || existingSet.has(tenant.id)) continue;

    const recurringTotal = (tenant.room.recurringCharges ?? [])
      .filter(c => {
        if (c.tenantId && c.tenantId !== tenant.id) return false;
        if (c.effectiveFrom && c.effectiveFrom > month) return false;
        if (c.effectiveTo   && c.effectiveTo   < month) return false;
        return true;
      })
      .reduce((sum, c) => sum + c.amount, 0);

    await prisma.payment.create({
      data: {
        userId:    tenant.userId,
        tenantId:  tenant.id,
        roomId:    tenant.roomId,
        month,
        amountDue: tenant.room.monthlyRent + recurringTotal,
        status:    "PENDING",
      },
    });
    created++;
  }

  if (created > 0) {
    console.log(`[scheduler] Auto-generated ${created} payment(s) for ${month} (billing day ${todayDay}).`);
  }
}

// ── 2. Overdue rent reminders (per-user) ─────────────────────────────────────

async function runRemindersForUser(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const lastRun = await prisma.setting.findUnique({
    where: { userId_key: { userId, key: "reminder_last_run" } },
  });
  if (lastRun?.value === today) return;

  const overduePayments = await prisma.payment.findMany({
    where: {
      userId,
      status: "OVERDUE",
      tenant: { whatsappNotify: true, moveOutDate: null },
    },
    include: { tenant: true, room: true },
  });

  // Mark today as done before sending to avoid duplicates on restart
  await prisma.setting.upsert({
    where:  { userId_key: { userId, key: "reminder_last_run" } },
    create: { userId, key: "reminder_last_run", value: today },
    update: { value: today },
  });

  if (overduePayments.length === 0) return;

  const [currencyRow, tplRow] = await Promise.all([
    prisma.setting.findUnique({ where: { userId_key: { userId, key: "currency_symbol" } } }),
    prisma.setting.findUnique({ where: { userId_key: { userId, key: "wa_tpl_rent_overdue" } } }),
  ]);
  const sym = currencyRow?.value ?? "रू";
  const fmt = (n: number) => formatCurrency(n, sym);

  let sent = 0;
  for (const payment of overduePayments) {
    if (!payment.tenant.phone) continue;
    const balance = payment.amountDue - payment.amountPaid;
    const msg = msgRentOverdue(
      payment.tenant.name,
      fmt(balance),
      formatMonth(payment.month),
      payment.room.name,
      tplRow?.value,
    );
    const ok = await sendWhatsAppMessage(payment.tenant.phone, msg);
    if (ok) sent++;
  }

  console.log(`[scheduler] User ${userId}: overdue reminders ${sent}/${overduePayments.length} sent.`);
}

// ── 2. Subscription maintenance (system-wide, once per day) ──────────────────

async function runSubscriptionMaintenance(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (g._subMaintenanceLastDate === today) return;
  g._subMaintenanceLastDate = today; // claim before async work (idempotent anyway)

  const now = new Date();

  // ── 2a. Auto-downgrade expired subscriptions ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expired = await (prisma.user.findMany as any)({
    where: {
      plan:         { in: ["basic", "starter", "pro"] },
      planExpiresAt: { lt: now },
    },
    select: { id: true, email: true, plan: true, planExpiresAt: true, phone: true },
  }) as { id: string; email: string; plan: string; planExpiresAt: Date; phone: string | null }[];

  for (const user of expired) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).subscriptionHistory.create({
        data: {
          userId:    user.id,
          plan:      "free",
          note:      `Auto-downgraded from ${user.plan} — expired ${user.planExpiresAt.toISOString().slice(0, 10)}`,
          changedBy: "system",
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma.user.update as any)({
        where: { id: user.id },
        data:  { plan: "free", planExpiresAt: null, billingCycle: null },
      });

      console.log(`[scheduler] Auto-downgraded ${user.email} from ${user.plan} to free (expired).`);
    } catch (err) {
      console.error(`[scheduler] Failed to downgrade ${user.email}:`, err);
    }
  }

  // ── 2b. Renewal reminders — 7 days and 1 day before expiry ─────────────────
  if (!(await isWhatsAppReady())) return;

  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expiringSoon = await (prisma.user.findMany as any)({
    where: {
      plan:          { in: ["basic", "starter", "pro"] },
      planExpiresAt: { gte: now, lte: sevenDaysLater },
      phone:         { not: null },
    },
    select: { id: true, email: true, plan: true, planExpiresAt: true, phone: true },
  }) as { id: string; email: string; plan: string; planExpiresAt: Date; phone: string }[];

  for (const user of expiringSoon) {
    const daysLeft = Math.ceil((user.planExpiresAt.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft !== 7 && daysLeft !== 1) continue; // only on exact 7d and 1d marks

    const reminderKey = `sub_reminder_${today}_${daysLeft}d`;

    // Skip if already sent today for this user
    const alreadySent = await prisma.setting.findUnique({
      where: { userId_key: { userId: user.id, key: reminderKey } },
    });
    if (alreadySent) continue;

    const expiryLabel = user.planExpiresAt.toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
    const planLabel = user.plan.charAt(0).toUpperCase() + user.plan.slice(1);

    const msg = daysLeft === 1
      ? `⚠️ *Rent Manager — Subscription Expiring Tomorrow*\n\nYour *${planLabel}* plan expires on *${expiryLabel}*.\n\nRenew now to keep uninterrupted access. Contact admin to renew.`
      : `🔔 *Rent Manager — Subscription Reminder*\n\nYour *${planLabel}* plan expires in *${daysLeft} days* (${expiryLabel}).\n\nContact admin to renew your subscription and avoid any disruption.`;

    const ok = await sendWhatsAppMessage(user.phone, msg);
    if (ok) {
      await prisma.setting.upsert({
        where:  { userId_key: { userId: user.id, key: reminderKey } },
        create: { userId: user.id, key: reminderKey, value: "1" },
        update: { value: "1" },
      });
      console.log(`[scheduler] Sent ${daysLeft}d renewal reminder to ${user.email}.`);
    }
  }
}

// ── Scheduler loop ───────────────────────────────────────────────────────────

export function initScheduler(): void {
  if (g._schedulerTimer) return; // hot-reload guard
  g._schedulerRunning       = false;
  g._subMaintenanceLastDate = "";

  // Tick every minute
  g._schedulerTimer = setInterval(async () => {
    try {
      const now           = new Date();
      const currentHour   = now.getHours();
      const currentMinute = now.getMinutes();

      // ── Monthly payment generation + subscription maintenance: once per day ──
      if (currentMinute < 5) {
        runMonthlyPaymentGeneration().catch(err =>
          console.error("[scheduler] Payment generation error:", err)
        );
        runSubscriptionMaintenance().catch(err =>
          console.error("[scheduler] Subscription maintenance error:", err)
        );
      }

      // ── Overdue reminders: only in the first 5 minutes of the configured hour ─
      if (currentMinute >= 5) return;

      const hourSettings = await prisma.setting.findMany({
        where: { key: "reminder_hour", value: String(currentHour) },
      });
      if (hourSettings.length === 0) return;

      const enabledUserIds = new Set(
        (await prisma.setting.findMany({
          where: {
            key:    "auto_reminders_enabled",
            value:  "true",
            userId: { in: hourSettings.map(s => s.userId) },
          },
        })).map(s => s.userId)
      );
      if (enabledUserIds.size === 0) return;

      if (g._schedulerRunning) return;
      g._schedulerRunning = true;
      try {
        if (!(await isWhatsAppReady())) return;
        for (const userId of enabledUserIds) {
          await runRemindersForUser(userId);
        }
      } finally {
        g._schedulerRunning = false;
      }
    } catch {
      // Ignore prisma errors during startup / shutdown
    }
  }, 60 * 1000);

  console.log("[scheduler] Scheduler started (payment generation + overdue reminders + subscription maintenance).");
}
