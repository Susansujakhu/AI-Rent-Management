"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

// Standard Android home-screen back behaviour for the installed PWA / TWA
// shell. Browser tabs are unaffected — the inApp check short-circuits.
//
//   At /dashboard:
//     • 1st back  → fading "Press back again to exit" toast (no navigation).
//     • 2nd back within ~2s → let the pop through (closes the TWA on a fresh
//       launch, or navigates back to the prior page if there's in-app history).
//
//   Every other page falls through to the browser's default back — exactly
//   like every other Android app: one step at a time.
export function PressAgainToExit() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inApp =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true ||
      document.referrer.startsWith("android-app://");
    if (!inApp) return;
    if (pathname !== "/dashboard") return;

    let exitArmed = false;
    let exitTimer: number | null = null;

    // Plant a guard so the first hardware back is interceptable instead of
    // exiting immediately. Skip if a guard is already on top.
    if (!(window.history.state && window.history.state.exitGuard)) {
      window.history.pushState({ exitGuard: true }, "");
    }

    function onPopState() {
      if (!exitArmed) {
        toast("Press back again to exit", {
          duration: 1800,
          position: "bottom-center",
        });
        window.history.pushState({ exitGuard: true }, "");
        exitArmed = true;
        if (exitTimer) clearTimeout(exitTimer);
        exitTimer = window.setTimeout(() => { exitArmed = false; }, 2000);
      } else {
        exitArmed = false;
        if (exitTimer) clearTimeout(exitTimer);
        setTimeout(() => window.history.back(), 0);
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [pathname]);

  return null;
}
