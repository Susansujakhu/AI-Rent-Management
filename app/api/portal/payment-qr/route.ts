import { NextResponse } from "next/server";
import { requireTenantAPI } from "@/lib/tenant-auth";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const QR_DIR      = join(process.cwd(), "storage", "payment-qr");
const VALID_TYPES = ["esewa", "khalti", "fonepay"] as const;
type QRType = typeof VALID_TYPES[number];

export async function GET(req: Request) {
  const { tenant, unauth } = await requireTenantAPI();
  if (unauth) return unauth;

  const type = new URL(req.url).searchParams.get("type") as QRType | null;
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const userId = tenant!.tenant.userId;
  const path   = join(QR_DIR, `${userId}-${type}.png`);

  if (!existsSync(path)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await readFile(path);
    return new NextResponse(data, {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "File error" }, { status: 500 });
  }
}
