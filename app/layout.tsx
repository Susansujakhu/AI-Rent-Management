import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/layout/sidebar";

export const metadata: Metadata = {
  title: "Rent Manager",
  description: "Property rental management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen overflow-hidden bg-gray-50">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 max-w-6xl mx-auto">{children}</div>
          </main>
        </div>
        <Toaster richColors />
      </body>
    </html>
  );
}
