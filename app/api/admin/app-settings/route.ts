import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = new Set([
  "beta_mode",
  "admin_whatsapp",
  // Landing-page hero stats — empty value means "show the live actual figure".
  "landing_stat_landlords",
  "landing_stat_collected",
  "landing_stat_bills",
  "landing_stat_rating",
]);

function compactRupees(n: number): string {
  // Nepali Rupee — matches lib/utils.ts:formatCurrency default.
  if (n >= 10_000_000) return `रू${(n / 10_000_000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (n >= 100_000)    return `रू${(n / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
  return `रू${n.toLocaleString("en-IN")}`;
}

export async function GET() {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  const [rows, landlordCount, billsCount, paymentsSum] = await Promise.all([
    prisma.$queryRaw<{ key: string; value: string }[]>`SELECT \`key\`, \`value\` FROM \`GlobalSetting\``,
    prisma.user.count({ where: { role: "user" } }),
    prisma.payment.count(),
    prisma.payment.aggregate({ _sum: { amountPaid: true } }),
  ]);

  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;

  // Expose the live actuals so the admin UI can show them as placeholders /
  // helper text next to the override inputs.
  return NextResponse.json({
    ...result,
    _computed: {
      landlords:  landlordCount.toLocaleString("en-IN"),
      collected:  compactRupees(paymentsSum._sum.amountPaid ?? 0),
      bills:      billsCount.toLocaleString("en-IN"),
      rating:     "4.9/5",
    },
  });
}

export async function PUT(req: Request) {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as Record<string, string>;
  const entries = Object.entries(body).filter(([k]) => ALLOWED_KEYS.has(k));
  if (entries.length === 0) return NextResponse.json({ error: "No valid keys" }, { status: 400 });

  await Promise.all(
    entries.map(([key, value]) =>
      prisma.$executeRaw`
        INSERT INTO \`GlobalSetting\` (\`key\`, \`value\`) VALUES (${key}, ${value})
        ON DUPLICATE KEY UPDATE \`value\` = ${value}
      `
    )
  );
  return NextResponse.json({ ok: true });
}
