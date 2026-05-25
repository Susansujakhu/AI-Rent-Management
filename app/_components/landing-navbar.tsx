"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, LayoutDashboard, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { LogoMark } from "@/components/brand/logo-mark";

export function LandingNavbar() {
  const [open,     setOpen]     = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted,  setMounted]  = useState(false);
  const { theme, setTheme }     = useTheme();

  useEffect(() => {
    setMounted(true);
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setLoggedIn(true); })
      .catch(() => {});

    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isDark = theme === "dark";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-sm shadow-slate-200/60 dark:shadow-slate-900/60 border-b border-slate-200/80 dark:border-slate-800/80"
        : "bg-transparent"
    }`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <LogoMark size={30} />
          <span className="font-bold text-slate-900 dark:text-white text-[16px] tracking-tight">EasyRent</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7">
          <a href="#features"     className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium">Features</a>
          <a href="#how-it-works" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium">How it works</a>
          <a href="#pricing"      className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium">Pricing</a>
          <a href="#faq"          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium">FAQ</a>
        </div>

        {/* Desktop CTAs + theme toggle */}
        <div className="hidden md:flex items-center gap-2">
          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}
          {loggedIn ? (
            <Link href="/dashboard"
              className="flex items-center gap-2 text-sm bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-xl font-semibold transition-colors">
              <LayoutDashboard size={14} /> Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login"
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors px-4 py-2 rounded-xl font-medium">
                Sign in
              </Link>
              <Link href="/signup"
                className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold transition-colors shadow-sm shadow-indigo-500/20">
                Get Started Free
              </Link>
            </>
          )}
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="md:hidden flex items-center gap-1">
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Toggle theme">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
          <button onClick={() => setOpen(!open)} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-2 transition-colors">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-4 py-4 space-y-1 shadow-lg">
          {["#features", "#how-it-works", "#pricing", "#faq"].map((href, i) => (
            <a key={href} href={href} onClick={() => setOpen(false)}
              className="block text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white py-2.5 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium">
              {["Features", "How it works", "Pricing", "FAQ"][i]}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
            {loggedIn ? (
              <Link href="/dashboard"
                className="flex items-center justify-center gap-2 text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 rounded-xl font-semibold">
                <LayoutDashboard size={14} /> Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login"
                  className="block text-sm text-slate-600 dark:text-slate-300 text-center py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium">
                  Sign in
                </Link>
                <Link href="/signup"
                  className="block text-sm bg-indigo-600 hover:bg-indigo-700 text-white text-center py-2.5 rounded-xl font-semibold transition-colors">
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
