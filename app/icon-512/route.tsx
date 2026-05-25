import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// PWA icon — 512×512. Higher-res variant used for splash screens and the
// "install app" prompt on Chrome. Same composition as the 192 version.

export const dynamic = "force-static";

const iconDataUri = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "logo-E-only.png")
).toString("base64")}`;

const SIZE = 512;
const INNER = 400;

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconDataUri} alt="" width={INNER} height={INNER} style={{ objectFit: "contain" }} />
      </div>
    ),
    { width: SIZE, height: SIZE }
  );
}
