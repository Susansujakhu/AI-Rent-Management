"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { currentMonth, formatMonth } from "@/lib/utils";

type Charge = { id: string; title: string; amount: number; effectiveFrom: string | null; effectiveTo: string | null };

export function TenantRecurringChargesPanel({
  tenantId,
  roomId,
  roomCharges,
  tenantCharges,
  currencySymbol,
  moveInMonth,
}: {
  tenantId: string;
  roomId: string;
  roomCharges: Charge[];
  tenantCharges: Charge[];
  currencySymbol: string;
  moveInMonth: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const defaultMonth = currentMonth() >= moveInMonth ? currentMonth() : moveInMonth;
  const [effectiveFrom, setEffectiveFrom] = useState(defaultMonth);
  const [saving, setSaving] = useState(false);
  const [titleErr, setTitleErr] = useState("");
  const [amountErr, setAmountErr] = useState("");
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [stopMonth,  setStopMonth]  = useState(currentMonth());
  const [stopping,   setStopping]   = useState(false);

  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString()}`;

  const handleAdd = async () => {
    setTitleErr("");
    setAmountErr("");
    let valid = true;
    if (!title.trim()) { setTitleErr("Title is required"); valid = false; }
    if (!amount || Number(amount) <= 0) { setAmountErr("Enter a valid amount greater than 0"); valid = false; }
    if (!valid) return;
    if (effectiveFrom < moveInMonth) {
      toast.error(`Effective from cannot be before move-in month (${moveInMonth})`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/recurring-charges`, {
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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <h2 className="font-semibold text-slate-900 dark:text-white">Recurring Charges</h2>

      {/* Room-level charges — read only */}
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Room-level (all tenants)
        </p>
        {roomCharges.length === 0 ? (
          <p className="text-sm text-slate-400">No room-level charges.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {roomCharges.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <span className={`text-sm ${c.effectiveTo ? "text-slate-400 line-through" : "text-slate-600 dark:text-slate-400"}`}>{c.title}</span>
                  {(c.effectiveFrom || c.effectiveTo) && (
                    <span className="ml-2 text-xs text-slate-400">
                      {c.effectiveFrom ? `from ${formatMonth(c.effectiveFrom)}` : ""}{c.effectiveTo ? ` to ${formatMonth(c.effectiveTo)}` : ""}
                    </span>
                  )}
                </div>
                <span className={`text-sm ${c.effectiveTo ? "text-slate-400" : "text-slate-700 dark:text-slate-300"}`}>{fmt(c.amount)}/mo</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tenant-specific charges — editable */}
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Tenant-specific (this tenant only)
        </p>
        {tenantCharges.length === 0 ? (
          <p className="text-sm text-slate-400 mb-2">No tenant-specific charges.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 mb-2">
            {tenantCharges.map((c) => {
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
                          onClick={() => { setStoppingId(isStopping ? null : c.id); setStopMonth(currentMonth() < (c.effectiveFrom ?? moveInMonth) ? (c.effectiveFrom ?? moveInMonth) : currentMonth()); }}
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
                        min={c.effectiveFrom ?? moveInMonth}
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
                      <span className="text-[11px] text-slate-400 w-full">Billed through {formatMonth(stopMonth)}; removed from later months. Past months are unchanged.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add tenant-specific charge form */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setTitleErr(""); }}
                placeholder="e.g. Internet"
                className={`${inputCls} ${titleErr ? "border-rose-400" : ""}`}
              />
              {titleErr && <p className="text-rose-500 text-xs mt-1">{titleErr}</p>}
            </div>
            <div>
              <input
                type="number"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); if (Number(e.target.value) > 0) setAmountErr(""); }}
                placeholder={`Amount ${currencySymbol}`}
                className={`w-28 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 ${amountErr ? "border-rose-400" : ""}`}
              />
              {amountErr && <p className="text-rose-500 text-xs mt-1">{amountErr}</p>}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Effective from</label>
              <input
                type="month"
                value={effectiveFrom}
                min={moveInMonth}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-slate-200"
              />
              {effectiveFrom && <span className="text-xs text-slate-400 whitespace-nowrap">({formatMonth(effectiveFrom)})</span>}
            </div>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
