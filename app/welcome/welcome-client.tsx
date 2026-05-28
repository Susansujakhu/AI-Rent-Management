"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { Playfair_Display } from "next/font/google";
import { LedgerDemo, ChatDemo, ReceiptDemo } from "./_demos";

const serif = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], display: "swap" });

const SLIDES = [
  {
    accent: "indigo",
    title: "Track every payment",
    body:  "See who's paid, who's overdue, and what's still coming in this month at a glance.",
  },
  {
    accent: "emerald",
    title: "Notify on WhatsApp",
    body:  "Send payment confirmations and overdue reminders without typing a single word.",
  },
  {
    accent: "amber",
    title: "Receipts in one tap",
    body:  "Crisp PDF receipts your tenants can save or share, automatic with every payment.",
  },
] as const;

// Per-slide colour kit: ambient glow behind the demo, aurora gradient on the
// background, and a matching gradient for the primary CTA.
const ACCENT: Record<string, {
  glow:      string;
  aurora:    string;
  cta:       string;
  ctaShadow: string;
}> = {
  indigo: {
    glow:      "bg-indigo-400",
    aurora:    "radial-gradient(closest-side, rgba(99,102,241,0.40), rgba(139,92,246,0.20), transparent)",
    cta:       "from-indigo-600 via-indigo-600 to-violet-600",
    ctaShadow: "shadow-indigo-300/60 dark:shadow-indigo-900/30",
  },
  emerald: {
    glow:      "bg-emerald-400",
    aurora:    "radial-gradient(closest-side, rgba(16,185,129,0.38), rgba(20,184,166,0.20), transparent)",
    cta:       "from-emerald-600 via-emerald-600 to-teal-600",
    ctaShadow: "shadow-emerald-300/60 dark:shadow-emerald-900/30",
  },
  amber: {
    glow:      "bg-amber-400",
    aurora:    "radial-gradient(closest-side, rgba(245,158,11,0.38), rgba(249,115,22,0.20), transparent)",
    cta:       "from-amber-500 via-amber-500 to-orange-500",
    ctaShadow: "shadow-amber-300/60 dark:shadow-amber-900/30",
  },
};

export function WelcomeClient() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  function markOnboarded() {
    try { localStorage.setItem("er:onboarded", "1"); } catch { /* private mode */ }
  }
  function go(path: string) {
    markOnboarded();
    router.replace(path);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 48) {
      if (dx < 0 && index < SLIDES.length - 1) setIndex(index + 1);
      else if (dx > 0 && index > 0) setIndex(index - 1);
    }
    touchStartX.current = null;
  }

  const slide  = SLIDES[index];
  const accent = ACCENT[slide.accent];
  const isLast = index === SLIDES.length - 1;
  const DEMOS  = [LedgerDemo, ChatDemo, ReceiptDemo] as const;
  const Demo   = DEMOS[index];

  return (
    <div
      className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Ambient aurora — keyed on index so it re-animates per slide change */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div
          key={`aurora-${index}`}
          className="absolute top-[18%] left-1/2 w-[680px] h-[680px] max-w-[150vw] max-h-[150vw] rounded-full blur-3xl welcome-aurora"
          style={{ background: accent.aurora, transform: "translateX(-50%)" }}
        />
      </div>

      {/* Top bar — the brand's own wordmark (so the font always matches the logo) + Skip */}
      <div className="flex items-center justify-between px-5 py-5 shrink-0 relative z-10">
        <span className="dark:hidden"><LogoMark variant="full" size={28} tone="light" /></span>
        <span className="hidden dark:block"><LogoMark variant="full" size={28} tone="dark" /></span>
        <button
          onClick={() => go("/login")}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Slide content — re-keys on index so all entry animations replay */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center relative z-10">
        <div key={index} className="flex flex-col items-center w-full">
          {/* Live mini product demo with a soft accent glow behind it */}
          <div className="relative w-full max-w-[280px] mx-auto">
            <div className={`absolute -inset-8 ${accent.glow} blur-3xl opacity-25 welcome-glow rounded-[2rem] pointer-events-none`} />
            <Demo />
          </div>

          <h1
            className={`${serif.className} text-3xl sm:text-[2.25rem] font-bold tracking-tight mt-10 mb-3.5 welcome-fade-up`}
            style={{ animationDelay: "120ms" }}
          >
            {slide.title}
          </h1>
          <p
            className="text-[15px] sm:text-base text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed welcome-fade-up"
            style={{ animationDelay: "220ms" }}
          >
            {slide.body}
          </p>

          {/* Swipe hint — only on the first slide, fades away once they move */}
          {index === 0 && (
            <div
              className="mt-8 flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 welcome-fade-up"
              style={{ animationDelay: "340ms" }}
            >
              <span>Swipe</span>
              <ArrowRight size={13} className="welcome-swipe-hint" />
            </div>
          )}

        </div>
      </div>

      {/* Pill progress dots */}
      <div className="flex justify-center gap-1.5 py-3 shrink-0 relative z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out ${
              i === index ? "w-7 bg-slate-900 dark:bg-white" : "w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
            }`}
          />
        ))}
      </div>

      {/* CTA — explicit transitions, scale(0.97) on press for honest feedback */}
      <div className="px-6 pb-9 pt-3 space-y-3 shrink-0 relative z-10">
        {/* Feature pills — only on the final slide, framing the CTA */}
        {isLast && (
          <div
            key={`pills-${index}`}
            className="flex flex-wrap justify-center gap-1.5 pb-1 welcome-fade-up"
            style={{ animationDelay: "300ms" }}
          >
            {["Tenant portal", "Electricity", "Online payments", "+ more"].map(label => (
              <span
                key={label}
                className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200/60 dark:ring-slate-700/60 backdrop-blur-sm"
              >
                {label}
              </span>
            ))}
          </div>
        )}
        {!isLast ? (
          <button
            onClick={() => setIndex(index + 1)}
            className={`w-full bg-gradient-to-r ${accent.cta} hover:saturate-150 active:scale-[0.97] text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-[transform,filter] duration-200 ease-out shadow-lg ${accent.ctaShadow}`}
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <>
            <button
              onClick={() => go("/signup")}
              className="w-full bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:saturate-150 active:scale-[0.97] text-white font-bold py-3.5 rounded-2xl transition-[transform,filter] duration-200 ease-out shadow-lg shadow-indigo-300/60 dark:shadow-indigo-900/30"
            >
              Get started for free
            </button>
            <button
              onClick={() => go("/login")}
              className="w-full text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium py-2 transition-colors"
            >
              I already have an account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
