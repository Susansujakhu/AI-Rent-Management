"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// If the landing page loads inside an installed PWA or the Android TWA shell,
// hop straight to the dashboard — marketing content has no role there.
// Existing TWA installs hard-code "/" as the launch URL in the APK, so the
// manifest start_url change alone wouldn't reroute them without a rebuild;
// this catches that case too.
export function RedirectIfStandalone() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari "Add to Home Screen"
      (window.navigator as { standalone?: boolean }).standalone === true ||
      // Android TWA — launched from the bundled Android app shell
      document.referrer.startsWith("android-app://");
    if (isStandalone) router.replace("/dashboard");
  }, [router]);
  return null;
}
