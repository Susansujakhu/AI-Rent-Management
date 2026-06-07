"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Undo2 } from "lucide-react";

export function SettlementActions({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);

  const handleVoid = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/settlement`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Settlement voided — tenant re-activated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to void settlement");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Undo move-out &amp; restore records?</span>
        <button
          onClick={handleVoid}
          disabled={loading}
          className="bg-rose-500 text-white px-2.5 py-1 rounded-lg font-semibold hover:bg-rose-600 disabled:opacity-50"
        >
          {loading ? "…" : "Void"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-slate-400 hover:text-slate-600 px-1">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/tenants/${tenantId}/settlement`}
        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 border border-indigo-100 dark:border-indigo-900 px-2.5 py-1 rounded-lg"
      >
        <FileText size={12} /> Statement
      </Link>
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-500 border border-slate-100 dark:border-slate-800 px-2.5 py-1 rounded-lg transition-colors"
      >
        <Undo2 size={12} /> Void
      </button>
    </div>
  );
}
