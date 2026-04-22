"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { currentMonth } from "@/lib/utils";

export function GeneratePaymentsButton() {
  const router = useRouter();
  const [month,   setMonth]   = useState(currentMonth());
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res  = await fetch("/api/payments/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate payments");
        return;
      }
      if (data.created === 0) {
        toast.info(data.skipped > 0
          ? `All ${data.skipped} tenants already have a payment for ${month}`
          : "No active tenants found for this month"
        );
      } else {
        toast.success(`Created ${data.created} payment${data.created !== 1 ? "s" : ""} for ${month}${data.skipped > 0 ? ` (${data.skipped} already existed)` : ""}`);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="month"
        value={month}
        onChange={e => setMonth(e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
      <button
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-semibold transition-colors disabled:opacity-60"
      >
        {loading
          ? <Loader2 size={14} className="animate-spin" />
          : <Sparkles size={14} />
        }
        Generate
      </button>
    </div>
  );
}
