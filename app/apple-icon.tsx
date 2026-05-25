import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// iOS home-screen icon — Apple displays this on the springboard and as
// the bookmark icon. Apple guidelines: solid background (no transparency).
// White rounded square + navy icon mirrors the favicon for brand continuity.

const iconDataUri = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "logo-E-only.png")
).toString("base64")}`;

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "white",
          borderRadius: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconDataUri} alt="" width={148} height={148} style={{ objectFit: "contain" }} />
      </div>
    ),
    { ...size }
  );
}
