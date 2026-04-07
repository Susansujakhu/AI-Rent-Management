"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

interface Props {
  paymentId:      string;
  paymentStatus:  string;
  hasPhone:       boolean;
  whatsappNotify: boolean;
}

export function SendReminderButton({ paymentId, paymentStatus, hasPhone, whatsappNotify }: Props) {
  const [open,   setOpen]   = useState(false);
  const [busy,   setBusy]   = useState<"due" | "overdue" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const send = async (type: "due" | "overdue") => {
    setBusy(type);
    setOpen(false);
    try {
      const res = await fetch("/api/whatsapp/send-reminder", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ paymentId, type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send notification");
      } else {
        toast.success("Notification sent via WhatsApp");
      }
    } catch {
      toast.error("Failed to send notification");
    } finally {
      setBusy(null);
    }
  };

  // Only show for non-paid payments; WhatsApp must be enabled and tenant must have a phone
  if (!hasPhone || !whatsappNotify) return null;

  const defaultType = paymentStatus === "OVERDUE" ? "overdue" : "due";
  const isBusy = busy !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={isBusy}
        title="Send WhatsApp notification"
        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40 font-medium"
      >
        <Bell size={12} className={isBusy ? "animate-pulse" : ""} />
        {isBusy ? "Sending…" : "Notify"}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 z-20 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/60 min-w-[170px] py-1.5 text-xs">
          <p className="px-3 py-1 text-slate-400 font-bold uppercase tracking-wider text-[10px]">Send Reminder</p>
          <button
            onClick={() => send("due")}
            className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors font-medium flex items-center gap-2 ${defaultType === "due" ? "text-indigo-600" : "text-slate-700"}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            Rent Due Notice
            {defaultType === "due" && <span className="ml-auto text-[10px] text-indigo-400 font-bold">default</span>}
          </button>
          <button
            onClick={() => send("overdue")}
            className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors font-medium flex items-center gap-2 ${defaultType === "overdue" ? "text-rose-600" : "text-slate-700"}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            Overdue Warning
            {defaultType === "overdue" && <span className="ml-auto text-[10px] text-rose-400 font-bold">default</span>}
          </button>
        </div>
      )}
    </div>
  );
}
