import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { readFile, unlink } from "fs/promises";
import { join } from "path";

const STORAGE_DIR = join(process.cwd(), "storage", "tenant-docs");

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const { docId } = await params;

  const doc = await prisma.tenantDocument.findFirst({
    where: { id: docId, userId: auth.id },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only let the browser render the file inline if it's a type the browser
  // can safely display. For anything else (Office docs, unknown types) force a
  // download so a malicious/mislabelled file can't run as HTML/script on the
  // same origin.
  const INLINE_SAFE = new Set([
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png", "image/webp",
  ]);
  const inlineRequested = new URL(req.url).searchParams.get("view") === "1";
  const inline = inlineRequested && INLINE_SAFE.has(doc.mimeType);

  try {
    const data = await readFile(join(STORAGE_DIR, doc.fileName));
    return new NextResponse(data, {
      headers: {
        // Keep the original mime type only for inline-safe formats; otherwise
        // serve as opaque bytes so the browser never tries to execute them.
        "Content-Type": inline ? doc.mimeType : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.name)}"`,
        "Content-Length": String(data.length),
        // Belt-and-suspenders: explicitly forbid the browser from sniffing.
        "X-Content-Type-Options": "nosniff",
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
