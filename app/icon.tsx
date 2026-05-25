import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// Browser tab favicon — the icon-only mark on a white rounded square.
// White backing ensures it's visible on both light and dark browser tabs
// (Chrome dark mode, Firefox private mode, Safari dark mode, etc).

const iconDataUri = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "logo-E-only.png")
).toString("base64")}`;

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "white",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconDataUri} alt="" width={26} height={26} style={{ objectFit: "contain" }} />
      </div>
    ),
    { ...size }
  );
}
