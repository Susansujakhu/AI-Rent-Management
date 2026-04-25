import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: "linear-gradient(145deg, #818cf8 0%, #6366f1 55%, #4f46e5 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {/* Roof */}
          <path d="M2 9.5L10 3L18 9.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Building body */}
          <rect x="3" y="9" width="14" height="9.5" rx="1.5" fill="white" fillOpacity="0.95" />
          {/* Door */}
          <rect x="7.5" y="13.5" width="5" height="5" rx="0.8" fill="#6366f1" />
          {/* Windows */}
          <rect x="4" y="11" width="4" height="3" rx="0.5" fill="#818cf8" fillOpacity="0.75" />
          <rect x="12" y="11" width="4" height="3" rx="0.5" fill="#818cf8" fillOpacity="0.75" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
