import sharp from "sharp";

const TARGET_BYTES = 900 * 1024; // 900 KB target
const MAX_WIDTH    = 1920;

export async function compressImage(input: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!mimeType.startsWith("image/")) return { buffer: input, mimeType };

  const img  = sharp(input).rotate(); // auto-rotate from EXIF
  const meta = await img.metadata();
  const w    = meta.width ?? MAX_WIDTH;

  const pipeline = () => {
    const s = sharp(input).rotate();
    if (w > MAX_WIDTH) s.resize(MAX_WIDTH, undefined, { withoutEnlargement: true });
    return s;
  };

  let out: Buffer = await pipeline().jpeg({ quality: 85, mozjpeg: true }).toBuffer() as Buffer;

  if (out.length > TARGET_BYTES) {
    for (const q of [75, 65, 55]) {
      out = await pipeline().jpeg({ quality: q, mozjpeg: true }).toBuffer() as Buffer;
      if (out.length <= TARGET_BYTES) break;
    }
  }

  return { buffer: out, mimeType: "image/jpeg" };
}
