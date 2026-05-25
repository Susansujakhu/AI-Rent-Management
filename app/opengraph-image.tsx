import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// Social-share preview image — shown when the landing page is linked on
// Facebook, WhatsApp, Slack, LinkedIn, etc.

const logoDataUri = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "logo-transparentbg.png")
).toString("base64")}`;

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #080c14 0%, #0f1628 60%, #0a0f20 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glows */}
        <div style={{
          position: "absolute", top: -80, left: -80,
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", bottom: -80, right: -80,
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)",
        }} />

        {/* Full lockup on a white card — keeps the navy artwork readable on the dark gradient */}
        <div style={{
          background: "white",
          borderRadius: 32,
          padding: "32px 56px",
          marginBottom: 36,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoDataUri} alt="" width={420} height={280} style={{ objectFit: "contain" }} />
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 38, color: "rgba(255,255,255,0.85)",
          textAlign: "center", maxWidth: 820, lineHeight: 1.4,
          marginBottom: 36, fontWeight: 600,
        }}>
          Manage your rental properties without the chaos
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: 14 }}>
          {["Rent Tracking", "PDF Receipts", "WhatsApp Reminders", "Tenant Portal"].map(f => (
            <div key={f} style={{
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.35)",
              borderRadius: 100,
              padding: "8px 22px",
              fontSize: 18,
              color: "rgba(251,191,36,0.9)",
            }}>
              {f}
            </div>
          ))}
        </div>

        {/* Domain badge */}
        <div style={{
          position: "absolute", bottom: 32,
          fontSize: 18, color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.05em",
        }}>
          easy-rent.xpertthemes.com
        </div>
      </div>
    ),
    { ...size }
  );
}
