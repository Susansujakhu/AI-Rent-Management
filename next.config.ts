import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "whatsapp-web.js",
    "puppeteer",
    "puppeteer-core",
    "qrcode",
  ],
};

export default nextConfig;
