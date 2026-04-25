import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { readFile, unlink } from "fs/promises";
import { join } from "path";

const STORAGE_DIR = join(process.cwd(), "storage", "tenant-docs");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const { docId } = await params;

  const doc = await prisma.tenantDocument.findFirst({
    where: { id: docId, userId: auth.id },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const data = await readFile(join(STORAGE_DIR, doc.fileName));
    return new NextResponse(data, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.name)}"`,
        "Content-Length": String(data.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const { docId } = await params;

  const doc = await prisma.tenantDocument.findFirst({
    where: { id: docId, userId: auth.id },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.tenantDocument.delete({ where: { id: docId } });

  try {
    await unlink(join(STORAGE_DIR, doc.fileName));
  } catch {
    // file may already be gone — not critical
  }

  return NextResponse.json({ ok: true });
}
