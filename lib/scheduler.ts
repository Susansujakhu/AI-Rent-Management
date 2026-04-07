/**
 * Daily automatic overdue reminder scheduler.
 * Runs inside the Next.js Node.js server process, started from instrumentation.ts.
 * Persists across hot-reloads via globalThis.
 */

import { prisma } from "./prisma";
import { getWAStatus, sendWhatsAppMessage, msgRentOverdue } from "./whatsapp";
import { formatCurrency, formatMonth } from "./utils";

interface SchedulerGlobal {
  _schedulerTimer:   ReturnType<typeof setInterval> | undefined;
  _schedulerRunning: boolean;
}

const g = globalThis as typeof globalThis & SchedulerGlobal;

// ── Core logic ───────────────────────────────────────────────────────────────

async function runDailyReminders(): Promise<void> {
  if (g._schedulerRunning) return; // prevent overlap
  g._schedulerRunning = true;

  try {
    // 1. Check feature flag
    const enabledRow = await prisma.setting.findUnique({ where: { key: "auto_reminders_enabled" } });
    if (enabledRow?.value !== "true") return;

    // 2. WhatsApp must be ready
    if (getWAStatus() !== "ready") return;

    // 3. Avoid sending more than once per calendar day
    const today    = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const lastRun  = await prisma.setting.findUnique({ where: { key: "reminder_last_run" } });
    if (lastRun?.value === today) return;

    // 4. Fetch all overdue payments whose tenants want WhatsApp notifications
    const overduePayments = await prisma.payment.findMany({
      where: {
        status: "OVERDUE",
        tenant: {
          whatsappNotify: true,
          moveOutDate:    null,
        },
      },
      include: { tenant: true, room: true },
    });

    // 5. Mark today as done *before* sending to avoid duplicate runs on restart
    await prisma.setting.upsert({
      where:  { key: "reminder_last_run" },
      create: { key: "reminder_last_run", value: today },
      update: { value: today },
    });

    if (overduePayments.length === 0) {
      console.log("[scheduler] No overdue payments to remind today.");
      return;
    }

    // 6. Load currency symbol and custom template once
    const [currencyRow, tplRow] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "currency_symbol" } }),
      prisma.setting.findUnique({ where: { key: "wa_tpl_rent_overdue" } }),
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

    console.log(`[scheduler] Overdue reminders: ${sent}/${overduePayments.length} sent.`);
  } catch (err) {
    console.error("[scheduler] Error running daily reminders:", err);
  } finally {
    g._schedulerRunning = false;
  }
}

// ── Scheduler loop ───────────────────────────────────────────────────────────

export function initScheduler(): void {
  if (g._schedulerTimer) return; // already running (hot-reload guard)
  g._schedulerRunning = false;

  // Check every minute whether it's time to send reminders.
  // The 5-minute window + reminder_last_run dedup guarantees exactly-once per day
  // even if the server restarts mid-hour.
  g._schedulerTimer = setInterval(async () => {
    try {
      const now = new Date();
      const hourRow = await prisma.setting.findUnique({ where: { key: "reminder_hour" } });
      const targetHour = parseInt(hourRow?.value ?? "9");
      if (now.getHours() === targetHour && now.getMinutes() < 5) {
        await runDailyReminders();
      }
    } catch {
      // Ignore prisma errors during startup / shutdown
    }
  }, 60 * 1000); // tick every 60 seconds

  console.log("[scheduler] Overdue reminder scheduler started.");
}
