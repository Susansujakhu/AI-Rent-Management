import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Rent Portal",
  description: "View your rent and payment details",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // AppShell already strips the admin sidebar for /portal routes.
  // This layout just provides the teal portal shell.
  return <>{children}</>;
}
