import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rent Manager",
  description: "Property rental management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="flex h-screen overflow-hidden bg-slate-50">
          {/* Sidebar — desktop only */}
          <div className="hidden md:flex">
            <Sidebar />
          </div>
          <main className="flex-1 overflow-y-auto scroll-smooth">
            {/* pb-20 on mobile to clear bottom nav */}
            <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24 md:pb-6">
              {children}
            </div>
          </main>
        </div>
        {/* Bottom nav — mobile only */}
        <BottomNav />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
