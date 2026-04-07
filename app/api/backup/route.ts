import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";

export async function GET(req: Request) {
  const unauth = await requireAuthAPI(); if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  if (searchParams.get("confirm") !== "1") {
    return NextResponse.json(
      { error: "Add ?confirm=1 to acknowledge you are downloading all tenant data." },
      { status: 400 }
    );
  }
  const [rooms, tenants, payments, expenses, charges, oneTimeCharges, settings] = await Promise.all([
    prisma.room.findMany(),
    prisma.tenant.findMany(),
    prisma.payment.findMany(),
    prisma.expense.findMany(),
    prisma.recurringCharge.findMany(),
    prisma.oneTimeCharge.findMany(),
    prisma.setting.findMany(),
  ]);

  const backup = {
    exported_at: new Date().toISOString(),
    version: 1,
    rooms,
    tenants,
    payments,
    expenses,
    recurringCharges: charges,
    oneTimeCharges,
    settings: settings.filter(s => !["auth_email", "auth_password_hash", "session_token"].includes(s.key)),
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="rent-manager-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
