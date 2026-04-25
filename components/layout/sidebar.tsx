"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, DoorOpen, Users, CreditCard, Wrench, Hammer, Zap, BarChart3, Settings, LogOut, Crown, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo-mark";

const links = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/rooms",       label: "Rooms",       icon: DoorOpen },
  { href: "/tenants",     label: "Tenants",     icon: Users },
  { href: "/payments",    label: "Payments",    icon: CreditCard },
  { href: "/expenses",    label: "Expenses",    icon: Wrench },
  { href: "/electricity", label: "Electricity", icon: Zap },
  { href: "/maintenance", label: "Maintenance", icon: Hammer },
  { href: "/reports",     label: "Reports",     icon: BarChart3 },
  { href: "/settings",    label: "Settings",    icon: Settings },
];

interface MeUser {
  email:              string;
  name?:              string;
  plan:               string;
  createdAt:          string;
  upgradeRequestedAt: string | null;
}

export function Sidebar() {
  const pathname             = usePathname();
  const router               = useRouter();
  const [me, setMe]          = useState<MeUser | null>(null);
  const [betaMode, setBetaMode] = useState(true);
  const [mounted, setMounted]   = useState(false);
  const { theme, setTheme }     = useTheme();

  useEffect(() => {
    setMounted(true);
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then((u: MeUser | null) => { if (u) setMe(u); });
    fetch("/api/app-config")
      .then(r => r.ok ? r.json() : null)
      .then((c: { betaMode: boolean } | null) => { if (c) setBetaMode(c.betaMode); });
  }, []);

  const email    = me?.email ?? "";
  const initials = email ? email.slice(0, 2).toUpperCase() : "ER";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen bg-slate-950 border-r border-slate-800/40 relative">
      {/* Top gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      {/* Brand + user */}
      <div className="px-4 pt-5 pb-4 border-b border-slate-800/40">
        <div className="flex items-center gap-2.5 mb-4">
          <LogoMark size={32} />
          <div>
            <p className="font-bold text-white text-[13px] tracking-tight leading-none">EasyRent</p>
            <p className="text-[10px] text-slate-600 font-medium">Property Manager</p>
          </div>
        </div>

        {/* User pill */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-md shadow-indigo-900/50">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-300 font-medium truncate leading-none mb-0.5">
              {email || "Loading…"}
            </p>
            {betaMode && (
              <p className="text-[9px] text-violet-400 font-semibold">Beta · Free access</p>
            )}
          </div>
        </div>
      </div>

      {/* Nav label */}
      <div className="px-4 pt-4 pb-1.5">
        <p className="text-[9px] font-bold tracking-[0.18em] text-slate-700 uppercase">Navigation</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 pb-3 space-y-0.5 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/60"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              )}>
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-indigo-300/60 -ml-px" />
              )}
              <Icon size={16} className={cn(
                "shrink-0 transition-colors duration-150",
                active ? "text-indigo-200" : "text-slate-500 group-hover:text-slate-300"
              )} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}

        {/* Beta / upgrade */}
        {betaMode ? (
          <div className="px-1 py-2">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-500/8 border border-violet-500/20">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-violet-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
              </span>
              <span className="text-[11px] font-bold text-violet-400 tracking-widest">BETA</span>
              <span className="text-[9px] text-violet-400/50 ml-auto font-semibold">Free access</span>
            </div>
          </div>
        ) : (
          <Link href="/upgrade"
            className={cn(
              "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              pathname === "/upgrade"
                ? "bg-amber-500 text-white shadow-md shadow-amber-900/30"
                : "text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            )}>
            <Crown size={16} className={cn("shrink-0", pathname === "/upgrade" ? "text-amber-100" : "text-amber-500")} />
            <span className="truncate">Upgrade Plan</span>
          </Link>
        )}
      </nav>

      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

      {/* Footer */}
      <div className="p-4 space-y-1">
        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="group flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent transition-all duration-150">
            {theme === "dark"
              ? <Sun size={14} className="shrink-0 text-slate-600 group-hover:text-amber-400 transition-colors" />
              : <Moon size={14} className="shrink-0 text-slate-600 group-hover:text-indigo-400 transition-colors" />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        )}
        <button onClick={handleLogout}
          className="group flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-rose-500/8 hover:text-rose-400 border border-transparent hover:border-rose-500/15 transition-all duration-150">
          <LogOut size={14} className="shrink-0 text-slate-600 group-hover:text-rose-400 transition-colors" />
          <span>Sign out</span>
        </button>
        <p className="text-[10px] text-slate-800 px-1 mt-1">&copy; {new Date().getFullYear()} Rent Manager</p>
      </div>
    </aside>
  );
}
