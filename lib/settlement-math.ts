// Pure settlement math — no Prisma, no IO. Unit-tested in tests/settlement-math.test.ts.
//
// Billing periods are anchored to the tenant's move-in day: payment "2026-06"
// covers Jun {moveInDay} → day before Jul {moveInDay}.

export function monthStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function resolveStatus(paid: number, due: number, wasOverdue: boolean): string {
  if (paid >= due) return "PAID";
  if (paid > 0)   return "PARTIAL";
  return wasOverdue ? "OVERDUE" : "PENDING";
}

/** Start date of the billing period labelled `month`, anchored to moveInDay
 *  (clamped to the period month's length, e.g. day 31 in Feb → Feb 28/29). */
export function periodStart(month: string, moveInDay: number): Date {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(moveInDay, daysInMonth));
}

/** The billing period ("YYYY-MM") that contains `date`. */
export function periodForDate(date: Date, moveInDay: number): string {
  let y = date.getFullYear();
  let m = date.getMonth() + 1;
  const start = periodStart(monthStr(y, m), moveInDay);
  if (date < start) {
    m--;
    if (m < 1) { m = 12; y--; }
  }
  return monthStr(y, m);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Pro-rate `baseAmount` for occupancy of period `month` up to `moveOutDate` (inclusive). */
export function prorate(
  month: string,
  moveInDay: number,
  moveOutDate: Date,
  baseAmount: number,
): { daysInPeriod: number; daysOccupied: number; proratedDue: number } {
  const start = periodStart(month, moveInDay);
  const [fy, fm] = month.split("-").map(Number);
  const nextMonth = fm === 12 ? monthStr(fy + 1, 1) : monthStr(fy, fm + 1);
  const daysInPeriod = daysBetween(start, periodStart(nextMonth, moveInDay));
  const daysOccupied = Math.min(daysBetween(start, moveOutDate) + 1, daysInPeriod);
  const proratedDue  = Math.round((daysOccupied / Math.max(daysInPeriod, 1)) * baseAmount);
  return { daysInPeriod, daysOccupied, proratedDue };
}

/** Recurring charges total applicable to a tenant's room for a given month. */
export function recurringTotalFor(
  charges: Array<{ tenantId: string | null; amount: number; effectiveFrom: string | null; effectiveTo: string | null }>,
  tenantId: string,
  month: string,
): number {
  return charges
    .filter(c => (c.tenantId === null || c.tenantId === tenantId)
      && (!c.effectiveFrom || c.effectiveFrom <= month)
      && (!c.effectiveTo   || month <= c.effectiveTo))
    .reduce((s, c) => s + c.amount, 0);
}

/** Settle dues against advance credit first, then deposit. Leftovers refund. */
export function settleTotals(
  totalDue: number,
  creditBalance: number,
  deposit: number,
): { creditApplied: number; depositApplied: number; balanceDue: number; refundDue: number } {
  const creditApplied  = Math.min(creditBalance, totalDue);
  const depositApplied = Math.min(deposit, totalDue - creditApplied);
  const balanceDue     = totalDue - creditApplied - depositApplied;
  const refundDue      = (deposit - depositApplied) + (creditBalance - creditApplied);
  return { creditApplied, depositApplied, balanceDue, refundDue };
}
