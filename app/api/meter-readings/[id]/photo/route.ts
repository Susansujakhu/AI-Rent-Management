import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAPI } from "@/lib/auth";
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { compressImage } from "@/lib/compress-image";

const PHOTO_DIR = join(process.cwd(), "storage", "meter-photos");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const reading = await prisma.meterReading.findFirst({ where: { id, userId: auth.id } });
  if (!reading?.photoPath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const path = join(PHOTO_DIR, reading.photoPath);
  if (!existsSync(path)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await readFile(path);
  return new NextResponse(data, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const reading = await prisma.meterReading.findFirst({ where: { id, userId: auth.id } });
  if (!reading) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file     = formData.get("photo") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Images only" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20 MB" }, { status: 400 });

  await mkdir(PHOTO_DIR, { recursive: true });

  // Delete old photo if exists
  if (reading.photoPath) {
    const old = join(PHOTO_DIR, reading.photoPath);
    if (existsSync(old)) await unlink(old).catch(() => {});
  }

  // eslint-disable-next-line prefer-const
  let buffer: Buffer = Buffer.from(await file.arrayBuffer() as ArrayBuffer);
  const compressed = await compressImage(buffer, file.type);
  buffer = compressed.buffer as Buffer;

  const fileName = `${id}.jpg`;
  await writeFile(join(PHOTO_DIR, fileName), buffer);

  await prisma.meterReading.update({ where: { id }, data: { photoPath: fileName } });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const reading = await prisma.meterReading.findFirst({ where: { id, userId: auth.id } });
  if (!reading) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (reading.photoPath) {
    const path = join(PHOTO_DIR, reading.photoPath);
    if (existsSync(path)) await unlink(path).catch(() => {});
    await prisma.meterReading.update({ where: { id }, data: { photoPath: null } });
  }

  return NextResponse.json({ ok: true });
}
