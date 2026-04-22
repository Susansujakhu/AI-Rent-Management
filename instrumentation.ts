export async function register() {
  // Only run on the Node.js server (not in the Edge runtime or during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initWhatsApp, SYSTEM_WA_KEY } = await import("./lib/whatsapp");
    const { initScheduler }               = await import("./lib/scheduler");
    // Auto-connect system WhatsApp on startup (uses saved LocalAuth session)
    initWhatsApp(SYSTEM_WA_KEY).catch(console.error);
    initScheduler();
  }
}
