"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { NotificationBell } from "@/components/notifications/notification-bell";

// Derive a friendly title from the current path so the header doubles as a
// breadcrumb. Falls back to "EasyRent" for routes we don't have a label for.
const TITLES: Record<string, string> = {
  "/dashboard":   "Dashboard",
  "/rooms":       "Rooms",
  "/tenants":     "Tenants",
  "/payments":    "Payments",
  "/maintenance": "Maintenance",
  "/inbox":       "Inbox",
  "/electricity": "Electricity",
  "/expenses":    "Expenses",
  "/reports":     "Reports",
  "/settings":    "Settings",
};

function titleFor(pathname: string): string {
  const exact = TITLES[pathname];
  if (exact) return exact;
  for (const [prefix, label] of Object.entries(TITLES)) {
    if (pathname.startsWith(prefix + "/")) return label;
  }
  return "EasyRent";
}

/**
 * Mobile-only sticky header. Sits above the page content on `md:hidden`
 * screens so the user always knows they're inside EasyRent and has access
 * to notifications + theme toggle even though the sidebar (which hosts
 * those on desktop) is hidden.
 */
export function MobileHeader() {
  const pathname              = usePathname();
  const title                 = titleFor(pathname);
  const { theme, setTheme }   = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes returns `undefined` until the client mounts — wait to render
  // the toggle so we don't flash the wrong icon during hydration.
  useEffect(() => { setMounted(true); }, []);
  const isDark = theme === "dark";

  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Light mode: subtle navy artwork on white surface.
            Dark mode: same artwork with crisp white stroke so it reads on slate-950. */}
        <span className="block dark:hidden">
          <LogoMark size={32} variant="mark" tone="light" />
        </span>
        <span className="hidden dark:block">
          <LogoMark size={32} variant="mark" tone="dark" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-[0.18em] leading-none">
            EasyRent
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mt-1 truncate">
            {title}
          </p>
        </div>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}

        <NotificationBell placement="header" />
      </div>
    </header>
  );
}
