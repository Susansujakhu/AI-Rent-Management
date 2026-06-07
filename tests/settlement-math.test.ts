import { describe, it, expect } from "vitest";
import {
  monthStr, resolveStatus, periodStart, periodForDate, daysBetween,
  prorate, recurringTotalFor, settleTotals,
} from "../lib/settlement-math";

describe("periodStart / periodForDate (move-in-day anchored billing)", () => {
  it("anchors the period to the move-in day", () => {
    // Move-in day 7 → period "2026-06" starts Jun 7
    expect(periodStart("2026-06", 7).toDateString()).toBe(new Date(2026, 5, 7).toDateString());
  });

  it("clamps day 31 to short months", () => {
    expect(periodStart("2026-02", 31).getDate()).toBe(28);   // Feb 2026
    expect(periodStart("2024-02", 31).getDate()).toBe(29);   // leap year
    expect(periodStart("2026-04", 31).getDate()).toBe(30);
  });

  it("assigns a date before the anchor day to the previous period", () => {
    // Move-in day 7: Jun 5 falls in the May 7 – Jun 6 period
    expect(periodForDate(new Date(2026, 5, 5), 7)).toBe("2026-05");
    // Jun 7 starts the June period
    expect(periodForDate(new Date(2026, 5, 7), 7)).toBe("2026-06");
    expect(periodForDate(new Date(2026, 5, 30), 7)).toBe("2026-06");
  });

  it("rolls over the year boundary", () => {
    // Move-in day 15: Jan 3 belongs to the Dec 15 – Jan 14 period of the prior year
    expect(periodForDate(new Date(2026, 0, 3), 15)).toBe("2025-12");
  });

  it("day-1 anchor matches calendar months", () => {
    expect(periodForDate(new Date(2026, 5, 1), 1)).toBe("2026-06");
    expect(periodForDate(new Date(2026, 5, 30), 1)).toBe("2026-06");
  });
});

describe("prorate", () => {
  it("charges the full period when occupied to the last day", () => {
    // Day-1 anchor June: Jun 1 – Jun 30 = 30 days
    const r = prorate("2026-06", 1, new Date(2026, 5, 30), 3000);
    expect(r.daysInPeriod).toBe(30);
    expect(r.daysOccupied).toBe(30);
    expect(r.proratedDue).toBe(3000);
  });

  it("pro-rates a mid-period move-out", () => {
    // Day-1 anchor June, move out Jun 15 → 15/30 days
    const r = prorate("2026-06", 1, new Date(2026, 5, 15), 3000);
    expect(r.daysOccupied).toBe(15);
    expect(r.proratedDue).toBe(1500);
  });

  it("uses the anchored period length, not the calendar month", () => {
    // Move-in day 7: period 2026-06 = Jun 7 – Jul 6 = 30 days; move out Jun 7 = 1 day
    const r = prorate("2026-06", 7, new Date(2026, 5, 7), 3000);
    expect(r.daysInPeriod).toBe(30);
    expect(r.daysOccupied).toBe(1);
    expect(r.proratedDue).toBe(100);
  });

  it("caps occupancy at the period length", () => {
    // Move-out date beyond the period end can't exceed daysInPeriod
    const r = prorate("2026-06", 1, new Date(2026, 6, 15), 3000);
    expect(r.daysOccupied).toBe(r.daysInPeriod);
    expect(r.proratedDue).toBe(3000);
  });

  it("rounds to the nearest whole amount", () => {
    // 7/30 days of 7400 = 1726.66… → 1727
    const r = prorate("2026-06", 1, new Date(2026, 5, 7), 7400);
    expect(r.proratedDue).toBe(1727);
  });
});

describe("settleTotals (credit first, then deposit)", () => {
  it("consumes credit before deposit", () => {
    const r = settleTotals(1000, 300, 5000);
    expect(r.creditApplied).toBe(300);
    expect(r.depositApplied).toBe(700);
    expect(r.balanceDue).toBe(0);
    expect(r.refundDue).toBe(4300);
  });

  it("reports balance due when credit + deposit fall short", () => {
    const r = settleTotals(10000, 300, 5000);
    expect(r.creditApplied).toBe(300);
    expect(r.depositApplied).toBe(5000);
    expect(r.balanceDue).toBe(4700);
    expect(r.refundDue).toBe(0);
  });

  it("refunds everything when there are no dues", () => {
    const r = settleTotals(0, 305, 20000);
    expect(r.creditApplied).toBe(0);
    expect(r.depositApplied).toBe(0);
    expect(r.balanceDue).toBe(0);
    expect(r.refundDue).toBe(20305);
  });

  it("is exact at the break-even point", () => {
    const r = settleTotals(5300, 300, 5000);
    expect(r.balanceDue).toBe(0);
    expect(r.refundDue).toBe(0);
  });

  it("conserves money: dues = applied + balance, holdings = applied + refund", () => {
    for (const [due, credit, deposit] of [[1234, 56, 789], [0, 0, 0], [99999, 100000, 1], [7400, 305, 0]] as const) {
      const r = settleTotals(due, credit, deposit);
      expect(r.creditApplied + r.depositApplied + r.balanceDue).toBe(due);
      expect(r.creditApplied + r.depositApplied + r.refundDue).toBe(credit + deposit);
    }
  });
});

describe("recurringTotalFor", () => {
  const charges = [
    { tenantId: null,  amount: 400, effectiveFrom: null,      effectiveTo: null },      // room-wide, open-ended
    { tenantId: "t1",  amount: 100, effectiveFrom: "2026-03", effectiveTo: "2026-06" }, // tenant-specific window
    { tenantId: "t2",  amount: 999, effectiveFrom: null,      effectiveTo: null },      // someone else's
  ];

  it("sums room-wide + own-tenant charges inside their window", () => {
    expect(recurringTotalFor(charges, "t1", "2026-05")).toBe(500);
  });

  it("excludes charges outside their effective window", () => {
    expect(recurringTotalFor(charges, "t1", "2026-07")).toBe(400);
    expect(recurringTotalFor(charges, "t1", "2026-02")).toBe(400);
  });

  it("never includes another tenant's charges", () => {
    expect(recurringTotalFor(charges, "t1", "2026-05")).not.toBeGreaterThan(500);
  });
});

describe("resolveStatus", () => {
  it("PAID when fully covered", () => expect(resolveStatus(100, 100, false)).toBe("PAID"));
  it("PARTIAL when partly covered", () => expect(resolveStatus(50, 100, true)).toBe("PARTIAL"));
  it("keeps OVERDUE for unpaid past bills", () => expect(resolveStatus(0, 100, true)).toBe("OVERDUE"));
  it("PENDING for unpaid current bills", () => expect(resolveStatus(0, 100, false)).toBe("PENDING"));
});

describe("monthStr / daysBetween", () => {
  it("pads months", () => expect(monthStr(2026, 6)).toBe("2026-06"));
  it("counts whole days", () => expect(daysBetween(new Date(2026, 5, 7), new Date(2026, 6, 7))).toBe(30));
});
