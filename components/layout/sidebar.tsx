"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, DoorOpen, Users, CreditCard, Wrench, BarChart3, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/",         label: "Dashboard", icon: LayoutDashboard },
  { href: "/rooms",    label: "Rooms",     icon: DoorOpen },
  { href: "/tenants",  label: "Tenants",   icon: Users },
  { href: "/payments", label: "Payments",  icon: CreditCard },
  { href: "/expenses", label: "Expenses",  icon: Wrench },
  { href: "/reports",  label: "Reports",   icon: BarChart3 },
  { href: "/settings", label: "Settings",  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then((u: { email: string } | null) => { if (u) setEmail(u.email); });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const initials = email ? email.slice(0, 2).toUpperCase() : "RM";

  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen bg-slate-950 border-r border-slate-800/50">

      {/* Logo / user area */}
      <div className="px-5 py-5 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 via-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-indigo-400/20 shrink-0">
            <span className="text-white font-extrabold text-xs tracking-tighter select-none">{initials}</span>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/10 pointer-events-none" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-[13px] tracking-tight leading-none mb-1">Rent Manager</p>
            <p className="text-[11px] text-slate-500 font-medium truncate">{email || "Loading…"}</p>
          </div>
        </div>
      </div>

      {/* Nav label */}
      <div className="px-5 pt-5 pb-1.5">
        <p className="text-[10px] font-semibold tracking-widest text-slate-600 uppercase">Navigation</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 pb-3 space-y-0.5 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                active
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/50"
                  : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
              )}>
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-indigo-300/70 -ml-px" />
              )}
              <Icon size={17} className={cn(
                "shrink-0 transition-colors duration-200",
                active ? "text-indigo-200" : "text-slate-500 group-hover:text-slate-300"
              )} />
              <span className="truncate">{label}</span>
              {active && <span className="absolute inset-0 rounded-xl bg-indigo-400/10 pointer-events-none" />}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

      {/* Footer */}
      <div className="p-4 space-y-3">
        <button onClick={handleLogout}
          className="group flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all duration-200">
          <LogOut size={15} className="shrink-0 text-slate-600 group-hover:text-red-400 transition-colors duration-200" />
          <span>Sign out</span>
        </button>
        <p className="text-[11px] text-slate-700 px-1">&copy; {new Date().getFullYear()} Rent Manager</p>
      </div>
    </aside>
  );
}
