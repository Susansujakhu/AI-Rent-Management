import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { compressImage } from "@/lib/compress-image";

const STORAGE_DIR = join(process.cwd(), "storage", "tenant-docs");
const MAX_SIZE_MB  = 10;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/png": "png", "image/webp": "webp",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[mime] ?? "bin";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const { id: tenantId } = await params;

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, userId: auth.id } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const docs = await prisma.tenantDocument.findMany({
    where:   { tenantId, userId: auth.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const { id: tenantId } = await params;

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, userId: auth.id } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file     = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "File type not allowed. Use PDF, images, or Office docs." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File too large. Max ${MAX_SIZE_MB} MB.` }, { status: 400 });
  }

  await mkdir(STORAGE_DIR, { recursive: true });

  const doc = await prisma.tenantDocument.create({
    data: {
      userId:   auth.id,
      tenantId,
      name:     file.name,
      fileName: "tmp",
      mimeType: file.type,
      size:     file.size,
    },
  });

  let buffer: Buffer   = Buffer.from(await file.arrayBuffer() as ArrayBuffer);
  let mimeType = file.type;

  if (file.type.startsWith("image/")) {
    const compressed = await compressImage(buffer, file.type);
    buffer   = compressed.buffer as Buffer;
    mimeType = compressed.mimeType;
  }

  const ext      = mimeType.startsWith("image/") ? "jpg" : extFromMime(file.type);
  const fileName = `${doc.id}.${ext}`;
  const filePath = join(STORAGE_DIR, fileName);

  await writeFile(filePath, buffer);

  const updated = await prisma.tenantDocument.update({
    where: { id: doc.id },
    data:  { fileName, mimeType, size: buffer.length },
  });

  return NextResponse.json(updated, { status: 201 });
}
