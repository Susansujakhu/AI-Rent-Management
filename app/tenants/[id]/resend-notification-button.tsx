"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  paymentId:      string;
  hasPhone:       boolean;
  whatsappNotify: boolean;
  isPro:          boolean;
}

export function ResendNotificationButton({ paymentId, hasPhone, whatsappNotify, isPro }: Props) {
  const [busy, setBusy] = useState(false);

  if (!isPro || !hasPhone || !whatsappNotify) return null;

  const send = async () => {
    setBusy(true);
    try {
      const res  = await fetch(`/api/payments/${paymentId}/notify`, { method: "POST" });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Failed to send notification");
      else toast.success("Payment receipt sent via WhatsApp");
    } catch {
      toast.error("Failed to send notification");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={send}
      disabled={busy}
      title="Resend payment receipt via WhatsApp"
      className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40 font-medium"
    >
      <MessageCircle size={12} className={busy ? "animate-pulse" : ""} />
      {busy ? "…" : "WA"}
    </button>
  );
}
