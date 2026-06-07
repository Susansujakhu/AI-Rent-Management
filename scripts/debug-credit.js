// Temporary debug: audit credit generated vs consumed vs balance (read-only)
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const t = await p.tenant.findFirst({
    where: { name: "Wangdel Lama" },
    select: { id: true, name: true, creditBalance: true },
  });

  // Credit GENERATED: sum of creditAmount across all transactions
  const gen = await p.paymentTransaction.aggregate({
    where: { payment: { tenantId: t.id } },
    _sum: { creditAmount: true },
  });

  // Credit CONSUMED with a trace: ADVANCE transactions
  const advTxns = await p.paymentTransaction.aggregate({
    where: { payment: { tenantId: t.id }, method: "ADVANCE" },
    _sum: { amount: true },
  });

  // Payments carrying the auto-apply note (pre-fix applications had no txn)
  const advPayments = await p.payment.findMany({
    where: { tenantId: t.id, OR: [{ method: "ADVANCE" }, { notes: { contains: "advance credit" } }] },
    select: { month: true, amountPaid: true, status: true, method: true, notes: true },
  });

  const generated = gen._sum.creditAmount ?? 0;
  const consumedTraced = advTxns._sum.amount ?? 0;
  console.log("Credit generated (all-time):", generated);
  console.log("Credit consumed via ADVANCE txns:", consumedTraced);
  console.log("Payments showing ADVANCE application:", JSON.stringify(advPayments));
  console.log("Current creditBalance:", t.creditBalance);
  console.log("UNACCOUNTED (lost):", generated - consumedTraced - t.creditBalance);
  await p.$disconnect();
})();
