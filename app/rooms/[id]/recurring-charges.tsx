"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { currentMonth, formatMonth } from "@/lib/utils";

type Charge = { id: string; title: string; amount: number; effectiveFrom: string | null; effectiveTo: string | null };

export function RecurringChargesPanel({
  roomId,
  charges,
  monthlyRent,
  currencySymbol,
}: {
  roomId: string;
  charges: Charge[];
  monthlyRent: number;
  currencySymbol: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(currentMonth());
  const [saving, setSaving] = useState(false);
  const [titleErr, setTitleErr] = useState("");
  const [amountErr, setAmountErr] = useState("");
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [stopMonth,  setStopMonth]  = useState(currentMonth());
  const [stopping,   setStopping]   = useState(false);

  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString()}`;
  const total = charges.filter(c => !c.effectiveTo).reduce((s, c) => s + c.amount, 0);

  const handleAdd = async () => {
    setTitleErr("");
    setAmountErr("");
    let valid = true;
    if (!title.trim()) { setTitleErr("Title is required"); valid = false; }
    if (!amount || Number(amount) <= 0) { setAmountErr("Enter a valid amount greater than 0"); valid = false; }
    if (!valid) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), amount: Number(amount), effectiveFrom }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      setAmount("");
      setEffectiveFrom(currentMonth());
      setTitleErr("");
      setAmountErr("");
      toast.success("Charge added");
      router.refresh();
    } catch {
      toast.error("Failed to add charge");
    } finally {
      setSaving(false);
    }
  };

  const handleStop = async (chargeId: string) => {
    setStopping(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/charges/${chargeId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ effectiveTo: stopMonth }),
      });
      if (!res.ok) { const d = await res.json().catch(() => null) as { error?: string } | null; throw new Error(d?.error || ""); }
      setStoppingId(null);
      toast.success(`Charge stopped — billed through ${formatMonth(stopMonth)}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Failed to stop charge");
    } finally {
      setStopping(false);
    }
  };

  const handleResume = async (chargeId: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/charges/${chargeId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ effectiveTo: null }),
      });
      if (!res.ok) throw new Error();
      toast.success("Charge resumed");
      router.refresh();
    } catch {
      toast.error("Failed to resume charge");
    }
  };

  const handleDelete = async (chargeId: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/charges/${chargeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Charge removed");
      router.refresh();
    } catch {
      toast.error("Failed to remove charge");
    }
  };

  const inputCls = "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-slate-200";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-900 dark:text-white">Room Charges</h2>
        {total > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Rent {fmt(monthlyRent)} + extras {fmt(total)}{" "}
            = <span className="font-semibold text-slate-800 dark:text-slate-200">{fmt(monthlyRent + total)}/mo</span>
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-3">Applies to all tenants in this room</p>

      {charges.length === 0 ? (
        <p className="text-sm text-slate-400 mb-3">No room-level charges yet.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 mb-3">
          {charges.map((c) => {
            const ended = !!c.effectiveTo;
            const isStopping = stoppingId === c.id;
            return (
              <div key={c.id} className="py-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <span className={`text-sm ${ended ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300"}`}>{c.title}</span>
                    {(c.effectiveFrom || ended) && (
                      <span className="ml-2 text-xs text-slate-400">
                        {c.effectiveFrom ? `from ${formatMonth(c.effectiveFrom)}` : ""}{ended ? ` to ${formatMonth(c.effectiveTo!)}` : ""}
                      </span>
                    )}
                    {ended && <span className="ml-1.5 text-[11px] font-semibold text-rose-400">· stopped</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-medium ${ended ? "text-slate-400" : "text-slate-900 dark:text-white"}`}>{fmt(c.amount)}/mo</span>
                    {ended ? (
                      <>
                        <button onClick={() => handleResume(c.id)} className="text-xs text-indigo-500 hover:text-indigo-700">Resume</button>
                        <button onClick={() => handleDelete(c.id)} className="text-xs text-rose-500 hover:text-rose-700">Delete</button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setStoppingId(isStopping ? null : c.id); setStopMonth(currentMonth() < (c.effectiveFrom ?? "0000-00") ? (c.effectiveFrom as string) : currentMonth()); }}
                        className="text-xs text-rose-500 hover:text-rose-700"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
                {isStopping && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Stop after</span>
                    <input
                      type="month"
                      value={stopMonth}
                      min={c.effectiveFrom ?? undefined}
                      onChange={(e) => setStopMonth(e.target.value)}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-400/50"
                    />
                    <button
                      onClick={() => handleStop(c.id)}
                      disabled={stopping}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-50 transition-colors"
                    >
                      {stopping ? "Stopping…" : "Confirm stop"}
                    </button>
                    <button onClick={() => setStoppingId(null)} className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
                    <span className="text-[11px] text-slate-400 w-full">Billed through {formatMonth(stopMonth)} for all tenants; removed from later months. Past months are unchanged.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2 space-y-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Add room charge</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setTitleErr(""); }}
              placeholder="e.g. Water supply"
              className={`${inputCls} ${titleErr ? "border-rose-400" : ""}`}
            />
            {titleErr && <p className="text-rose-500 text-xs mt-1">{titleErr}</p>}
          </div>
          <div className="sm:w-28">
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); if (Number(e.target.value) > 0) setAmountErr(""); }}
              placeholder={`Amount ${currencySymbol}`}
              className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 ${amountErr ? "border-rose-400" : ""}`}
            />
            {amountErr && <p className="text-rose-500 text-xs mt-1">{amountErr}</p>}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Effective from</label>
            <input
              type="month"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-slate-200"
            />
            {effectiveFrom && <span className="text-xs text-slate-400 whitespace-nowrap">({formatMonth(effectiveFrom)})</span>}
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 sm:py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
