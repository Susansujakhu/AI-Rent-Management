import { ImageResponse } from "next/og";

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
          background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)",
        }} />

        {/* Logo mark */}
        <div style={{
          width: 100, height: 100, borderRadius: 24,
          background: "linear-gradient(145deg, #818cf8 0%, #6366f1 55%, #4f46e5 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 32,
          boxShadow: "0 0 80px rgba(99,102,241,0.6), 0 20px 40px rgba(0,0,0,0.4)",
        }}>
          <svg width="62" height="62" viewBox="0 0 62 62" fill="none">
            <path d="M5 30L31 8L57 30" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="7" y="28" width="48" height="30" rx="5" fill="white" fillOpacity="0.95" />
            <rect x="23" y="42" width="16" height="16" rx="2.5" fill="#6366f1" />
            <rect x="10" y="34" width="13" height="11" rx="2" fill="#818cf8" fillOpacity="0.75" />
            <rect x="39" y="34" width="13" height="11" rx="2" fill="#818cf8" fillOpacity="0.75" />
          </svg>
        </div>

        {/* Brand name */}
        <div style={{
          fontSize: 88, fontWeight: 900, color: "white",
          letterSpacing: "-4px", lineHeight: 1, marginBottom: 20,
        }}>
          EasyRent
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 30, color: "rgba(255,255,255,0.45)",
          textAlign: "center", maxWidth: 680, lineHeight: 1.5,
          marginBottom: 48,
        }}>
          Manage your rental properties without the chaos
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: 16 }}>
          {["Rent Tracking", "PDF Receipts", "WhatsApp Reminders", "Tenant Portal"].map(f => (
            <div key={f} style={{
              background: "rgba(99,102,241,0.15)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 100,
              padding: "8px 20px",
              fontSize: 18,
              color: "rgba(255,255,255,0.6)",
            }}>
              {f}
            </div>
          ))}
        </div>

        {/* Domain badge */}
        <div style={{
          position: "absolute", bottom: 36,
          fontSize: 18, color: "rgba(129,140,248,0.7)",
          letterSpacing: "0.04em",
        }}>
          easy-rent.xpertthemes.com
        </div>
      </div>
    ),
    { ...size }
  );
}
