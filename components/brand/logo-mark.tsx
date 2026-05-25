import Image from "next/image";

interface LogoMarkProps {
  /** Height in px. Width is derived from the chosen variant's aspect ratio. */
  size?:    number;
  /** `full` = icon + "easyrent" wordmark. `mark` = icon only. */
  variant?: "full" | "mark";
  /**
   * `light`     = transparent. Navy artwork reads on white / light surfaces.
   * `dark`      = transparent + a white drop-shadow halo around the artwork.
   *               Elegant for minimal dark surfaces (footer, navbar dark mode).
   * `dark-card` = wraps the same artwork in a white rounded badge. Use when
   *               the surrounding surface is already busy (gradient panels,
   *               sidebars with lots of chrome) and a clean card sits well.
   */
  tone?:    "light" | "dark" | "dark-card";
  className?: string;
}

const FULL_RATIO = 1.5;   // logo-transparentbg.png
const MARK_RATIO = 1.0;   // logo-E-only.png

// Visible white stroke for tone="dark" — 4 cardinal + 4 diagonal drop-shadows
// at 1px give a solid uniform outline that traces the artwork. The final
// soft shadow adds a touch of separation from the dark surface without
// reading as a halo.
const DARK_STROKE_FILTER =
  "drop-shadow(1px 0 0 rgba(255,255,255,0.95)) " +
  "drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) " +
  "drop-shadow(0 1px 0 rgba(255,255,255,0.95)) " +
  "drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) " +
  "drop-shadow(0.7px 0.7px 0 rgba(255,255,255,0.95)) " +
  "drop-shadow(-0.7px 0.7px 0 rgba(255,255,255,0.95)) " +
  "drop-shadow(0.7px -0.7px 0 rgba(255,255,255,0.95)) " +
  "drop-shadow(-0.7px -0.7px 0 rgba(255,255,255,0.95)) " +
  "drop-shadow(0 0 5px rgba(255,255,255,0.2))";

// A very subtle dark stroke on light surfaces — barely visible.
const LIGHT_STROKE_FILTER =
  "drop-shadow(0 0 0.4px rgba(15, 23, 42, 0.35))";

export function LogoMark({
  size      = 32,
  variant   = "full",
  tone      = "light",
  className = "",
}: LogoMarkProps) {
  const src    = variant === "mark" ? "/logo-E-only.png" : "/logo-transparentbg.png";
  const ratio  = variant === "mark" ? MARK_RATIO : FULL_RATIO;
  const height = size;
  const width  = Math.round(size * ratio);

  // tone="dark" gets a crisp 4-direction white outline so navy reads on dark
  // without a card; tone="light" gets a barely-there dark stroke;
  // tone="dark-card" is the white-badge fallback (rarely needed now).
  const filter =
    tone === "dark"      ? DARK_STROKE_FILTER :
    tone === "dark-card" ? undefined :
                           LIGHT_STROKE_FILTER;

  const img = (
    <Image
      src={src}
      alt="EasyRent"
      width={width}
      height={height}
      priority
      sizes={`${width}px`}
      className="shrink-0"
      style={filter ? { filter } : undefined}
    />
  );

  if (tone === "dark-card") {
    // Tight padding so the badge reads as part of the logo, not as a card
    // wrapping it. A whisper of a slate border softens the hard white edge.
    const pad = Math.max(3, Math.round(size * 0.10));
    return (
      <div
        className={`shrink-0 inline-flex items-center justify-center bg-white rounded-lg border border-slate-200/60 ${className}`}
        style={{ padding: `${pad}px ${pad * 1.5}px` }}
      >
        {img}
      </div>
    );
  }

  return <div className={`shrink-0 inline-flex ${className}`}>{img}</div>;
}
