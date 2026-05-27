import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const CLAIM_DIR = join(process.cwd(), "storage", "payment-claims");

// Owner-only: serve a tenant's payment-proof screenshot. Scoped to the
// owner's own claims so one landlord can't read another's uploads.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const claim = await prisma.paymentClaim.findFirst({
    where:  { id, userId: auth.id },
    select: { screenshotPath: true },
  });
  if (!claim?.screenshotPath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const path = join(CLAIM_DIR, claim.screenshotPath);
  if (!existsSync(path)) return NextResponse.json({ error: "File missing" }, { status: 404 });

  const data = await readFile(path);
  return new NextResponse(data, {
    headers: {
      "Content-Type":          "image/jpeg",
      "Content-Disposition":   "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control":         "private, max-age=3600",
    },
  });
}
