"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrendingUp, Plus, X } from "lucide-react";

export interface RentHistoryRow {
  id:            string;
  amount:        number;
  effectiveFrom: string;             // YYYY-MM
  reason:        string | null;
  createdAt:     string;             // ISO
}

function formatMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1).toLocaleDateString("en", { month: "short", year: "numeric" });
}

function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const nextY = mo === 12 ? y + 1 : y;
  const nextM = mo === 12 ? 1     : mo + 1;
  return `${nextY}-${String(nextM).padStart(2, "0")}`;
}

export function RentHistoryPanel({
  roomId,
  currencySymbol,
  history,
  currentRent,
}: {
  roomId:         string;
  currencySymbol: string;
  history:        RentHistoryRow[];  // newest first (effectiveFrom desc)
  currentRent:    number;
}) {
  const router = useRouter();
  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString()}`;

  // Default effective-from = the month after the latest history row (or this month if no history)
  const defaultEffectiveFrom = history[0]
    ? nextMonth(history[0].effectiveFrom)
    : new Date().toISOString().slice(0, 7);

  const [open,           setOpen]           = useState(false);
  const [amount,         setAmount]         = useState("");
  const [effectiveFrom,  setEffectiveFrom]  = useState(defaultEffectiveFrom);
  const [reason,         setReason]         = useState("");
  const [applyToUnpaid,  setApplyToUnpaid]  = useState(true);
  const [submitting,     setSubmitting]     = useState(false);
  const [err,            setErr]            = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) { setErr("Enter a valid rent amount"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/rent-increment`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount: num, effectiveFrom, reason: reason.trim() || undefined, applyToUnpaid }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; recomputed?: number };
      if (!res.ok) { setErr(data.error ?? "Failed to apply increment"); return; }
      toast.success(
        data.recomputed
          ? `Rent updated. ${data.recomputed} unpaid bill${data.recomputed === 1 ? "" : "s"} adjusted.`
          : "Rent updated",
      );
      setOpen(false);
      setAmount("");
      setReason("");
      router.refresh();
    } catch {
      setErr("Failed to apply increment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current rent + action */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Rent</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight">{fmt(currentRent)}<span className="text-sm font-medium text-slate-400">/mo</span></p>
          {history[0] && (
            <p className="text-xs text-slate-400 mt-0.5">since {formatMonth(history[0].effectiveFrom)}</p>
          )}
        </div>
        <button
          onClick={() => { setOpen(true); setEffectiveFrom(defaultEffectiveFrom); }}
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <TrendingUp size={14} />
          Increase rent
        </button>
      </div>

      {/* History list */}
      {history.length > 0 && (
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50/60 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">History · {history.length} {history.length === 1 ? "entry" : "entries"}</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {history.map((h, idx) => {
              const next = history[idx - 1];                            // newer row (since sorted desc)
              const rangeEnd = next ? `until ${formatMonth(next.effectiveFrom)}` : "(current)";
              return (
                <div key={h.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {fmt(h.amount)}<span className="text-xs font-normal text-slate-400">/mo</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatMonth(h.effectiveFrom)} {rangeEnd}
                    </p>
                    {h.reason && <p className="text-xs text-slate-400 mt-1 italic">{h.reason}</p>}
                  </div>
                  {idx === 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full shrink-0">CURRENT</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
             onClick={() => !submitting && setOpen(false)}>
          <form
            onSubmit={submit}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Increase rent</h3>
                <p className="text-xs text-slate-400 mt-0.5">Records a new rate. Past PAID/PARTIAL bills are never changed.</p>
              </div>
              <button type="button" onClick={() => !submitting && setOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">New rent ({currencySymbol})</label>
              <input
                type="number" min={1} step="any" required autoFocus
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={`Current: ${currentRent}`}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Effective from</label>
              <input
                type="month" required
                value={effectiveFrom}
                min={history[0] ? nextMonth(history[0].effectiveFrom) : undefined}
                onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {history[0] && (
                <p className="text-[11px] text-slate-400 mt-1">Must be after {formatMonth(history[0].effectiveFrom)} (last change).</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Annual review, market rate"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <input
                type="checkbox"
                checked={applyToUnpaid}
                onChange={e => setApplyToUnpaid(e.target.checked)}
                className="accent-indigo-600 w-4 h-4 rounded mt-0.5"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold">Apply to unpaid bills from {formatMonth(effectiveFrom)} onward</span>
                <br />
                <span className="text-slate-400">Only affects bills with no money received. Partial/Paid bills are never changed.</span>
              </span>
            </label>

            {err && <p className="text-xs text-rose-500">{err}</p>}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={submitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                <Plus size={14} />
                {submitting ? "Saving…" : "Apply increment"}
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={submitting}
                className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
