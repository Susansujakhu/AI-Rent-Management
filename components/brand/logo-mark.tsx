interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 32, className = "" }: LogoMarkProps) {
  const r = Math.round(size * 0.26);
  const icon = Math.round(size * 0.58);

  return (
    <div
      className={`shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30 ${className}`}
      style={{ width: size, height: size, borderRadius: r }}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none">
        <path
          d="M2.5 10.5L12 3.5L21.5 10.5"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="3.5" y="10" width="17" height="11.5" rx="1.5" fill="white" fillOpacity="0.95" />
        <rect x="9" y="15" width="6" height="6.5" rx="1" fill="#6366f1" />
        <rect x="5" y="12" width="4.5" height="3.5" rx="0.5" fill="#818cf8" fillOpacity="0.8" />
        <rect x="14.5" y="12" width="4.5" height="3.5" rx="0.5" fill="#818cf8" fillOpacity="0.8" />
      </svg>
    </div>
  );
}
