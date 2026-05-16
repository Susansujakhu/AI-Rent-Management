export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { initScheduler } = await import("./lib/scheduler");
      initScheduler();
    } catch (err) {
      console.warn("Scheduler init skipped:", err);
    }
    try {
      const { autoStartDirectWA } = await import("./lib/whatsapp-direct");
      autoStartDirectWA().catch(console.error);
    } catch (err) {
      console.warn("WhatsApp direct auto-start skipped:", err);
    }
  }
}
