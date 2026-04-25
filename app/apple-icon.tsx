import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "linear-gradient(145deg, #818cf8 0%, #6366f1 55%, #4f46e5 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="108" height="108" viewBox="0 0 108 108" fill="none">
          <path d="M8 52L54 16L100 52" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="12" y="49" width="84" height="51" rx="8" fill="white" fillOpacity="0.95" />
          <rect x="40" y="73" width="28" height="27" rx="4" fill="#6366f1" />
          <rect x="16" y="57" width="24" height="18" rx="3" fill="#818cf8" fillOpacity="0.75" />
          <rect x="68" y="57" width="24" height="18" rx="3" fill="#818cf8" fillOpacity="0.75" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
