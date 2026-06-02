// Minimal Resend integration — no SDK, direct HTTPS call. Same shape as
// lib/whatsapp.ts: best-effort send that returns a boolean and never throws.
//
// Env vars:
//   RESEND_API_KEY   — your Resend API key (required)
//   RESEND_FROM      — verified sender, e.g. "EasyRent <noreply@example.com>"
//                       (optional; falls back to onboarding@resend.dev for
//                       testing before you verify a domain)

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(
  to:      string,
  subject: string,
  html:    string,
  text?:   string,
): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("[email] Skipping — RESEND_API_KEY not set");
    return false;
  }
  if (!to || !to.includes("@")) {
    console.warn("[email] Skipping — invalid 'to':", to);
    return false;
  }
  const from = process.env.RESEND_FROM || "EasyRent <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[email] Send failed:", JSON.stringify(err));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Network error:", err);
    return false;
  }
}

// Convert WhatsApp-flavoured text (*bold*, _italic_, newlines, URLs) into a
// minimal HTML email body. Escapes HTML first to prevent injection from
// message content.
export function whatsappToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const bolded   = escaped.replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>");
  const italics  = bolded.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  // Auto-link bare URLs
  const linked   = italics.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#4f46e5">$1</a>',
  );
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#1e293b;max-width:560px">${linked.replace(/\n/g, "<br>")}</div>`;
}
