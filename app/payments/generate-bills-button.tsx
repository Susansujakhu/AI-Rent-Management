"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export function GenerateBillsButton({ month }: { month: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      toast.success(`Generated ${data.created} new bill${data.created !== 1 ? "s" : ""}`);
      router.refresh();
    } catch {
      toast.error("Failed to generate bills");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-200/60 hover:shadow-lg hover:shadow-indigo-200/80 hover:-translate-y-0.5 active:translate-y-0"
    >
      <Sparkles size={14} className={loading ? "animate-pulse" : ""} />
      {loading ? "Generating…" : "Generate Bills"}
    </button>
  );
}
