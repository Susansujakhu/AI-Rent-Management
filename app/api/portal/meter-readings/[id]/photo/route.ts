import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAPIByToken } from "@/lib/tenant-auth";
import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { compressImage } from "@/lib/compress-image";

const PHOTO_DIR = join(process.cwd(), "storage", "meter-photos");

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const t      = tenant!;
  const { id } = await params;

  const reading = await prisma.meterReading.findFirst({ where: { id, tenantId: t.id } });
  if (!reading?.photoPath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const path = join(PHOTO_DIR, reading.photoPath);
  if (!existsSync(path)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await readFile(path);
  return new NextResponse(data, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const t = tenant!;
  const { id } = await params;

  const reading = await prisma.meterReading.findFirst({
    where: { id, tenantId: t.id, submittedByTenant: true },
  });
  if (!reading) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file     = formData.get("photo") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Images only" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20 MB" }, { status: 400 });

  await mkdir(PHOTO_DIR, { recursive: true });

  const buffer             = Buffer.from(await file.arrayBuffer());
  const { buffer: compressed } = await compressImage(buffer, file.type);
  const filename           = `${id}.jpg`;
  await writeFile(join(PHOTO_DIR, filename), compressed);

  await prisma.meterReading.update({ where: { id }, data: { photoPath: filename } });

  return NextResponse.json({ ok: true });
}
