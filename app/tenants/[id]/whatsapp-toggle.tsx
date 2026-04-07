"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

export function WhatsAppToggle({ tenantId, enabled }: { tenantId: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    const next = !on;
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNotify: next }),
      });
      if (!res.ok) throw new Error();
      setOn(next);
      toast.success(next ? "WhatsApp notifications enabled" : "WhatsApp notifications disabled");
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? "bg-green-50" : "bg-slate-50"}`}>
          <MessageCircle size={16} className={on ? "text-green-600" : "text-slate-400"} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">WhatsApp Notifications</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {on ? "Payment confirmations & reminders will be sent" : "No WhatsApp messages will be sent"}
          </p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        className={`relative w-11 h-6 rounded-full transition-all duration-200 focus:outline-none disabled:opacity-50 ${on ? "bg-green-500" : "bg-slate-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
