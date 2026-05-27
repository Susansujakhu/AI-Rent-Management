import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

// A native <details> accordion used to tuck away set-once / reference sections
// on the tenant page so the money views stay front-and-centre. Pure HTML/CSS
// toggle — safe to render inside the server component (no client JS).
export function CollapsibleGroup({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  children,
}: {
  title:       string;
  subtitle?:   string;
  icon:        ReactNode;
  defaultOpen?: boolean;
  children:    ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer list-none select-none rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 group-open:rounded-b-none group-open:border-b-0 [&::-webkit-details-marker]:hidden">
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>
        <ChevronDown size={16} className="text-slate-400 shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="space-y-4 rounded-b-2xl border border-t-0 border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 p-3 sm:p-4">
        {children}
      </div>
    </details>
  );
}
