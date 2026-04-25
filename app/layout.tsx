import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "next-themes";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "EasyRent — Manage Rent Like a Pro", template: "%s | EasyRent" },
  description: "Track rent, utilities, and payments across all your rooms. Generate professional receipts, send WhatsApp reminders, and give tenants a self-service portal — all in one place.",
  keywords: ["rent management", "property management", "rental tracker", "landlord app", "rent collection"],
  openGraph: {
    title: "EasyRent — Manage Rent Like a Pro",
    description: "Track rent, utilities, and payments across all your rooms.",
    siteName: "EasyRent",
    url: "https://easy-rent.xpertthemes.com",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EasyRent — Manage Rent Like a Pro",
    description: "Track rent, utilities, and payments across all your rooms.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange={false}>
          <AppShell>{children}</AppShell>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
