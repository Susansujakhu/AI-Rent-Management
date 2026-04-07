"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, CreditCard, Receipt, User, LogOut, Building2 } from "lucide-react";
import { toast } from "sonner";

const NAV = [
  { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/payments",  label: "Payments",  icon: CreditCard },
  { href: "/portal/charges",   label: "Charges",   icon: Receipt },
  { href: "/portal/profile",   label: "Profile",   icon: User },
];

export function PortalShell({
  tenantName,
  roomName,
  children,
}: {
  tenantName: string;
  roomName:   string | null;
  children:   React.ReactNode;
}) {
  const pathname = usePathname();
  const router   = useRouter();

  const initials = tenantName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    await fetch("/api/portal/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/portal");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 min-h-screen sticky top-0 bg-white border-r border-slate-100">

        {/* Logo area */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-sm shadow-teal-200">
              <Building2 size={15} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm tracking-tight">Tenant Portal</span>
          </div>

          {/* Tenant card */}
          <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl p-4 text-white shadow-md shadow-teal-200/60">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-black text-sm mb-3">
              {initials}
            </div>
            <p className="font-bold text-sm leading-tight">{tenantName}</p>
            {roomName && (
              <p className="text-teal-100 text-xs mt-0.5 font-medium">{roomName}</p>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Menu</p>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-teal-50 text-teal-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                  active ? "bg-teal-100 text-teal-600" : "text-slate-400 group-hover:text-slate-600"
                }`}>
                  <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                </span>
                {label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-500" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all duration-150"
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-lg group-hover:bg-rose-100 transition-colors">
              <LogOut size={15} />
            </span>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile top header ────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-xs font-black shadow-sm shadow-teal-200">
              {initials}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm leading-tight">{tenantName}</p>
              {roomName && <p className="text-slate-400 text-xs">{roomName}</p>}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-slate-400 hover:text-rose-500 text-xs font-medium transition-colors p-2 rounded-lg hover:bg-rose-50"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 pb-24 md:pb-0">
        {/* Desktop page header bar */}
        <div className="hidden md:block border-b border-slate-100 bg-white px-8 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Building2 size={12} />
              <span>Tenant Portal</span>
              <span>/</span>
              <span className="text-slate-600 font-medium capitalize">
                {pathname.split("/").filter(Boolean).slice(-1)[0] ?? "Dashboard"}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-5 md:px-8 md:py-8">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom nav ────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-100 flex z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors ${
                active ? "text-teal-600" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className={`flex items-center justify-center w-9 h-6 rounded-lg transition-colors ${
                active ? "bg-teal-50" : ""
              }`}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              </span>
              {label}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 bg-teal-500 rounded-b-full" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
