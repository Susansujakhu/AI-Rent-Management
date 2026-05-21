export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Refuse to boot if OTP bypass is on in production. Misconfiguring this
    // turns every OTP-gated flow (signup, password reset, login MFA) into
    // "code 000000 works for any phone" — full account takeover.
    if (process.env.NODE_ENV === "production" && process.env.BYPASS_PHONE_OTP === "true") {
      console.error("[startup] FATAL: BYPASS_PHONE_OTP=true is not allowed when NODE_ENV=production. Refusing to boot.");
      process.exit(1);
    }

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
