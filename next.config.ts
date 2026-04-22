import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "whatsapp-web.js",
    "puppeteer",
    "puppeteer-core",
    "qrcode",
    "@whiskeysockets/baileys",
    "jimp",
    "sharp",
    "pino",
  ],
};

export default nextConfig;
