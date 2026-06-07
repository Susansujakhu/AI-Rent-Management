import { describe, it, expect } from "vitest";
import { buildCoveragePreview, type UnpaidMonth, type UnpaidCharge } from "../lib/payment-distribution";

const month = (id: string, m: string, due: number, paid = 0): UnpaidMonth =>
  ({ id, month: m, amountDue: due, amountPaid: paid, status: paid > 0 ? "PARTIAL" : "PENDING" });

const charge = (id: string, title: string, amount: number, paid = 0): UnpaidCharge =>
  ({ id, title, amount, amountPaid: paid });

describe("buildCoveragePreview — distribution order", () => {
  const months = [
    month("apr", "2026-04", 7400, 4920),  // 2480 balance (older)
    month("may", "2026-05", 7400),        // initiating
    month("jun", "2026-06", 7400),        // newer
  ];

  it("clears charges first when opted in, then older months, then initiating", () => {
    const items = buildCoveragePreview(10500, months, [charge("e", "Electricity", 315)], true, "may");
    expect(items.map(i => i.kind)).toEqual(["charge", "payment", "payment", "credit"]);
    expect(items[0]).toMatchObject({ kind: "charge", amount: 315, full: true });
    expect(items[1]).toMatchObject({ amount: 2480, full: true });   // April balance
    expect(items[2]).toMatchObject({ amount: 7400, full: true });   // May (initiating)
    expect(items[3]).toMatchObject({ kind: "credit", amount: 305 }); // the famous रू305
  });

  it("skips charges when opted out", () => {
    const items = buildCoveragePreview(2480, months, [charge("e", "Electricity", 315)], false, "may");
    expect(items[0]).toMatchObject({ kind: "payment", amount: 2480, full: true });
    expect(items.find(i => i.kind === "charge")).toBeUndefined();
  });

  it("partially covers the initiating month when funds run out", () => {
    const items = buildCoveragePreview(5000, months, [], true, "may");
    expect(items[0]).toMatchObject({ amount: 2480, full: true });               // April first
    expect(items[1]).toMatchObject({ amount: 2520, full: false, remainingAfter: 4880 }); // May partial
    expect(items.find(i => i.kind === "credit")).toBeUndefined();
  });

  it("clears newer months only when fully covered", () => {
    // Enough for Apr + May + June in full
    const full = buildCoveragePreview(2480 + 7400 + 7400, months, [], true, "may");
    expect(full.filter(i => i.kind === "payment")).toHaveLength(3);
    expect(full.find(i => i.kind === "credit")).toBeUndefined();

    // 100 short of June: June must NOT be partially paid — remainder becomes credit
    const short = buildCoveragePreview(2480 + 7400 + 7300, months, [], true, "may");
    expect(short.filter(i => i.kind === "payment")).toHaveLength(2);
    expect(short.find(i => i.kind === "credit")).toMatchObject({ amount: 7300 });
  });

  it("turns pure overpayment into credit", () => {
    const items = buildCoveragePreview(8000, [month("may", "2026-05", 7400)], [], true, "may");
    expect(items[0]).toMatchObject({ kind: "payment", amount: 7400, full: true });
    expect(items[1]).toMatchObject({ kind: "credit", amount: 600 });
  });

  it("conserves the entered amount across all items", () => {
    for (const entered of [1, 315, 2480, 5000, 10500, 25000]) {
      const items = buildCoveragePreview(entered, months, [charge("e", "Electricity", 315)], true, "may");
      const distributed = items.reduce((s, i) => s + i.amount, 0);
      expect(distributed).toBe(entered);
    }
  });
});
