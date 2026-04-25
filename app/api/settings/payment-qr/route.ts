import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const QR_DIR      = join(process.cwd(), "storage", "payment-qr");
const VALID_TYPES = ["esewa", "khalti", "fonepay"] as const;
type QRType = typeof VALID_TYPES[number];

function qrPath(userId: string, type: QRType) {
  return join(QR_DIR, `${userId}-${type}.png`);
}

/** GET /api/settings/payment-qr?type=esewa — serve the QR image */
export async function GET(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const type = new URL(req.url).searchParams.get("type") as QRType | null;
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const path = qrPath(auth.id, type);
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

/** POST /api/settings/payment-qr?type=esewa — upload QR image (multipart) */
export async function POST(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const type = new URL(req.url).searchParams.get("type") as QRType | null;
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const formData = await req.formData();
  const file     = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files allowed" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 2 MB" }, { status: 400 });
  }

  await mkdir(QR_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(qrPath(auth.id, type), buffer);

  return NextResponse.json({ ok: true, type });
}

/** DELETE /api/settings/payment-qr?type=esewa — remove QR image */
export async function DELETE(req: Request) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const type = new URL(req.url).searchParams.get("type") as QRType | null;
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try { await unlink(qrPath(auth.id, type)); } catch { /* already gone */ }
  return NextResponse.json({ ok: true });
}
