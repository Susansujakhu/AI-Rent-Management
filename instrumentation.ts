export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { initScheduler } = await import("./lib/scheduler");
      initScheduler();
    } catch (err) {
      console.warn("Scheduler init skipped:", err);
    }
    try {
      const { initWhatsApp, SYSTEM_WA_KEY } = await import("./lib/whatsapp");
      initWhatsApp(SYSTEM_WA_KEY).catch(console.error);
    } catch (err) {
      console.warn("WhatsApp init skipped - not available on this server");
    }
  }
}
