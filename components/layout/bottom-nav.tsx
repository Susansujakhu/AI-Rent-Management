"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, CreditCard, Receipt, MoreHorizontal, DoorOpen, BarChart3, Settings, X, LogOut, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const primary = [
  { href: "/",         label: "Home",     icon: LayoutDashboard },
  { href: "/tenants",  label: "Tenants",  icon: Users },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
];

const secondary = [
  { href: "/rooms",    label: "Rooms",    icon: DoorOpen },
  { href: "/reports",  label: "Reports",  icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface MeUser {
  plan:               string;
  createdAt:          string;
  upgradeRequestedAt: string | null;
}

export function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then((u: MeUser | null) => { if (u) setMe(u); });
  }, []);

  const isPaid     = me?.plan === "pro" || me?.plan === "starter";
  const trialDays  = me && !isPaid
    ? Math.max(0, Math.ceil((new Date(me.createdAt).getTime() + 90 * 86_400_000 - Date.now()) / 86_400_000))
    : 0;
  const showUpgrade = !isPaid;
  const pending     = showUpgrade && !!me?.upgradeRequestedAt;

  const handleLogout = async () => {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isSecondaryActive = secondary.some(({ href }) => pathname.startsWith(href)) || (showUpgrade && pathname === "/upgrade");

  return (
    <>
      {/* More drawer */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />

          {/* Drawer panel */}
          <div className="fixed bottom-[72px] left-3 right-3 z-50 md:hidden bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/15 border border-slate-200/80 overflow-hidden animate-scale-in">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">More</p>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <X size={12} className="text-slate-500" />
              </button>
            </div>

            {/* Drawer items */}
            <div className="p-2">
              {secondary.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link key={href} href={href} onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150",
                      active ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    )}>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", active ? "bg-indigo-100" : "bg-slate-100")}>
                      <Icon size={16} className={active ? "text-indigo-600" : "text-slate-500"} />
                    </div>
                    {label}
                  </Link>
                );
              })}

              {/* Upgrade — non-paid users only */}
              {showUpgrade && (
                <Link href="/upgrade" onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150",
                    pathname === "/upgrade" ? "bg-amber-50 text-amber-700" : "text-amber-600 hover:bg-amber-50"
                  )}>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", pathname === "/upgrade" ? "bg-amber-100" : "bg-amber-50")}>
                    <Crown size={16} className="text-amber-600" />
                  </div>
                  <span className="flex-1">Upgrade to Pro</span>
                  {pending && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  )}
                </Link>
              )}

              {/* Sign out */}
              <button onClick={handleLogout}
                className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium w-full text-rose-500 hover:bg-rose-50 transition-all duration-150">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-50">
                  <LogOut size={16} className="text-rose-500" />
                </div>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        {/* Top gradient border */}
        <div className="h-px bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent" />

        <div className="bg-white/90 backdrop-blur-xl shadow-[0_-8px_32px_rgba(0,0,0,0.08)]">
          <div className="flex items-stretch h-[68px] px-1">

            {primary.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all duration-200"
                >
                  {/* Pill indicator for active item */}
                  <div className={cn(
                    "flex items-center justify-center w-10 h-8 rounded-full transition-all duration-200",
                    active
                      ? "bg-indigo-600 shadow-md shadow-indigo-500/30"
                      : "hover:bg-slate-100"
                  )}>
                    <Icon
                      size={20}
                      className={cn(
                        "transition-colors duration-200",
                        active ? "text-white" : "text-slate-400"
                      )}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold tracking-tight transition-colors duration-200",
                    active ? "text-indigo-600" : "text-slate-400"
                  )}>
                    {label}
                  </span>
                </Link>
              );
            })}

            {/* More button */}
            <button
              onClick={() => setOpen(!open)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all duration-200 relative"
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-8 rounded-full transition-all duration-200",
                isSecondaryActive || open
                  ? "bg-indigo-600 shadow-md shadow-indigo-500/30"
                  : "hover:bg-slate-100"
              )}>
                <MoreHorizontal
                  size={20}
                  className={cn(
                    "transition-colors duration-200",
                    isSecondaryActive || open ? "text-white" : "text-slate-400"
                  )}
                />
              </div>
              <span className={cn(
                "text-[10px] font-semibold tracking-tight transition-colors duration-200",
                isSecondaryActive || open ? "text-indigo-600" : "text-slate-400"
              )}>
                More
              </span>
              {/* Pending dot on More button */}
              {pending && !open && (
                <span className="absolute top-1.5 right-3 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
              )}
            </button>

          </div>

          {/* Safe area spacer for iOS */}
          <div className="h-safe-bottom" />
        </div>
      </nav>
    </>
  );
}
