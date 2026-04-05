"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Users, CreditCard, Receipt, MoreHorizontal, DoorOpen, BarChart3, Settings, X } from "lucide-react";
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

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isSecondaryActive = secondary.some(({ href }) => pathname.startsWith(href));

  return (
    <>
      {/* More drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 md:hidden bg-black/20 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-[64px] left-3 right-3 z-50 md:hidden bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">More</p>
              <button onClick={() => setOpen(false)}>
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="p-2">
              {secondary.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                      active
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <Icon size={18} className={active ? "text-indigo-600" : "text-slate-400"} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex items-stretch h-16">
          {primary.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-xl transition-all",
                  active ? "bg-indigo-50" : ""
                )}>
                  <Icon size={19} className={active ? "text-indigo-600" : "text-slate-400"} />
                </div>
                <span className={cn(
                  "text-[10px] font-semibold",
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
            className="flex-1 flex flex-col items-center justify-center gap-1"
          >
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-xl transition-all",
              isSecondaryActive || open ? "bg-indigo-50" : ""
            )}>
              <MoreHorizontal size={19} className={isSecondaryActive || open ? "text-indigo-600" : "text-slate-400"} />
            </div>
            <span className={cn(
              "text-[10px] font-semibold",
              isSecondaryActive || open ? "text-indigo-600" : "text-slate-400"
            )}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
