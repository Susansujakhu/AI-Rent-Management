import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EasyRent — Manage Rent Like a Pro",
    short_name: "EasyRent",
    description:
      "Track rent, utilities, and payments across all your rooms. Generate professional receipts, send WhatsApp reminders, and give tenants a self-service portal.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",   // PWA splash backdrop — matches the white-backed icon
    theme_color: "#1B2F5C",        // Browser chrome (address bar) — navy from the logo
    categories: ["business", "finance", "productivity"],
    lang: "en",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
