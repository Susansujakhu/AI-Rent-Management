import { ImageResponse } from "next/og";

export const dynamic = "force-static";

const SIZE = 192;
const INNER = 116;

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
          background: "linear-gradient(145deg, #818cf8 0%, #6366f1 55%, #4f46e5 100%)",
        }}
      >
        <svg width={INNER} height={INNER} viewBox="0 0 20 20" fill="none">
          <path d="M2 9.5L10 3L18 9.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="9" width="14" height="9.5" rx="1.5" fill="white" fillOpacity="0.95" />
          <rect x="7.5" y="13.5" width="5" height="5" rx="0.8" fill="#6366f1" />
          <rect x="4" y="11" width="4" height="3" rx="0.5" fill="#818cf8" fillOpacity="0.75" />
          <rect x="12" y="11" width="4" height="3" rx="0.5" fill="#818cf8" fillOpacity="0.75" />
        </svg>
      </div>
    ),
    { width: SIZE, height: SIZE }
  );
}
