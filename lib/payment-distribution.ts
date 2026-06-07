// Pure payment-distribution preview — no IO. Mirrors the server's distribution
// rule in /api/payments/[id] PUT: one-time charges first (when opted in), then
// older unpaid months oldest-first, then the initiating month, then newer
// months (full clearance only), and any remainder becomes advance credit.
// Unit-tested in tests/payment-distribution.test.ts.

export type UnpaidMonth = {
  id: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  status: string;
};

export type UnpaidCharge = {
  id: string;
  title: string;
  amount: number;
  amountPaid: number;
};

export type PreviewItem =
  | { kind: "payment"; label: string; amount: number; full: boolean; remainingAfter: number }
  | { kind: "charge";  label: string; amount: number; full: boolean; remainingAfter: number }
  | { kind: "credit";  amount: number };

export function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
}

export function buildCoveragePreview(
  entered: number,
  allUnpaid: UnpaidMonth[],
  unpaidCharges: UnpaidCharge[],
  applyToOneTime: boolean,
  initiatingId: string,
): PreviewItem[] {
  const preview: PreviewItem[] = [];
  let remaining = entered;

  // When checkbox is checked: clear one-time charges first, then rent months
  if (applyToOneTime) {
    for (const c of unpaidCharges) {
      if (remaining <= 0) break;
      const bal = c.amount - c.amountPaid;
      if (bal <= 0) continue;
      const apply = Math.min(remaining, bal);
      preview.push({ kind: "charge", label: c.title, amount: apply, full: apply >= bal, remainingAfter: bal - apply });
      remaining -= apply;
    }
  }

  const initiating      = allUnpaid.find(u => u.id === initiatingId);
  const initiatingMonth = initiating?.month;

  // 1) Older unpaid months (before initiating) — oldest first, partial allowed
  if (initiatingMonth) {
    for (const u of allUnpaid) {
      if (remaining <= 0) break;
      if (u.id === initiatingId) continue;
      if (u.month >= initiatingMonth) continue;
      const bal = u.amountDue - u.amountPaid;
      if (bal <= 0) continue;
      const apply = Math.min(remaining, bal);
      preview.push({ kind: "payment", label: formatMonth(u.month), amount: apply, full: apply >= bal, remainingAfter: bal - apply });
      remaining -= apply;
    }
  }

  // 2) Initiating payment (full or partial)
  if (initiating && remaining > 0) {
    const bal = initiating.amountDue - initiating.amountPaid;
    if (bal > 0) {
      const apply = Math.min(remaining, bal);
      preview.push({ kind: "payment", label: formatMonth(initiating.month), amount: apply, full: apply >= bal, remainingAfter: bal - apply });
      remaining -= apply;
    }
  }

  // 3) Newer unpaid months — full clearance only (mirrors backend)
  if (initiatingMonth) {
    for (const u of allUnpaid) {
      if (remaining <= 0) break;
      if (u.id === initiatingId) continue;
      if (u.month <= initiatingMonth) continue;
      const bal = u.amountDue - u.amountPaid;
      if (bal <= 0) continue;
      if (remaining < bal) break;
      preview.push({ kind: "payment", label: formatMonth(u.month), amount: bal, full: true, remainingAfter: 0 });
      remaining -= bal;
    }
  }

  // 4) Whatever's left goes to the tenant's credit balance.
  if (remaining > 0) {
    preview.push({ kind: "credit", amount: remaining });
  }

  return preview;
}
