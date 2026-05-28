"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { MobileHeader } from "./mobile-header";
import { NotificationProvider } from "@/lib/notification-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage    = pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/welcome";
  const isPortalPage  = pathname.startsWith("/portal");
  const isAdminPage   = pathname.startsWith("/admin");
  const isLandingPage = pathname === "/";
  const isOfflinePage = pathname === "/offline";

  if (isAuthPage || isPortalPage || isAdminPage || isLandingPage || isOfflinePage) {
    return <>{children}</>;
  }

  return (
    <NotificationProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <MobileHeader />
          <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24 md:pb-6">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </NotificationProvider>
  );
}
