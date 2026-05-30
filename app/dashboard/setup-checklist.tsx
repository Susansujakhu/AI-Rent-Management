"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight, X, Sparkles } from "lucide-react";

// First-run setup card. Server passes which steps are already satisfied (based
// on rows in the DB); this client component handles user-driven dismissal via
// localStorage and self-hides once every step is done.
export function SetupChecklist({
  hasRooms,
  hasTenants,
  hasPayments,
}: {
  hasRooms:    boolean;
  hasTenants:  boolean;
  hasPayments: boolean;
}) {
  // Start hidden so we don't flash the card before reading localStorage.
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem("er:setupHidden") === "1");
    } catch { /* private mode */ }
  }, []);

  const steps = [
    { label: "Sign up",               done: true,        href: null,           hint: "Account created. Welcome aboard." },
    { label: "Add your first room",   done: hasRooms,    href: "/rooms/new",   hint: "Define the spaces you rent out." },
    { label: "Add a tenant",          done: hasTenants,  href: "/tenants/new", hint: "Link a renter to a room." },
    { label: "Record a payment",      done: hasPayments, href: "/payments",    hint: "Mark rent as paid and send a receipt." },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const allDone   = doneCount === steps.length;

  function dismiss() {
    try { localStorage.setItem("er:setupHidden", "1"); } catch { /* private mode */ }
    setHidden(true);
  }

  if (hidden || allDone) return null;

  return (
    <div className="relative bg-gradient-to-br from-indigo-50 via-violet-50/40 to-white dark:from-indigo-500/10 dark:via-violet-500/5 dark:to-slate-900 rounded-2xl border border-indigo-200/60 dark:border-indigo-500/20 shadow-sm overflow-hidden">
      <div className="pointer-events-none absolute top-2 right-12 text-indigo-400/25 dark:text-indigo-400/15">
        <Sparkles size={64} />
      </div>

      <button
        onClick={dismiss}
        aria-label="Hide setup checklist"
        className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
      >
        <X size={15} />
      </button>

      <div className="px-5 pt-5 pb-3 relative">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Get started</p>
          <span className="text-[11px] font-bold text-slate-400">{doneCount} / {steps.length}</span>
        </div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          A few quick steps to set up your account
        </h2>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full max-w-[260px] rounded-full bg-indigo-100/70 dark:bg-indigo-500/15 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500 ease-out"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <ul className="px-2 pb-3 relative">
        {steps.map((s, i) => {
          const interactive = !s.done && !!s.href;
          const inner = (
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              interactive ? "hover:bg-white/70 dark:hover:bg-slate-800/40" : ""
            }`}>
              {s.done ? (
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              ) : (
                <Circle size={18} strokeWidth={2.25} className="text-slate-300 dark:text-slate-600 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${
                  s.done ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"
                }`}>
                  {s.label}
                </p>
                <p className="text-xs text-slate-400 truncate">{s.hint}</p>
              </div>
              {interactive && <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />}
            </div>
          );
          return (
            <li key={i}>
              {interactive ? <Link href={s.href!}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
