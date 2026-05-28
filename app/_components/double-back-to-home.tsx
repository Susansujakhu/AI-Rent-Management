"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// In the installed PWA / Android TWA shell only: a quick double-tap of the
// hardware back button jumps to /dashboard instead of walking the entire
// history back to the launch screen. Browser tabs are unaffected.
export function DoubleBackToHome() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const inApp =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true ||
      document.referrer.startsWith("android-app://");
    if (!inApp) return;

    let lastBack = 0;
    function onPopState() {
      const now = Date.now();
      if (now - lastBack < 600) {
        // Second back within ~600 ms → jump straight home.
        lastBack = 0;
        router.replace("/dashboard");
      } else {
        // First back press in a new window — let the route change normally.
        lastBack = now;
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);
  return null;
}
