"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, X } from "lucide-react";

type Deduction = { title: string; amount: string };

type Preview = {
  finalMonth: {
    month: string;
    baseAmount: number;
    proratedDue: number;
    daysOccupied: number;
    daysInPeriod: number;
  } | null;
  lines: Array<{ type: string; label: string; outstanding: number }>;
  deletedFutureMonths: string[];
  totalDue: number;
  creditBalance: number;
  depositHeld: number;
  creditApplied: number;
  depositApplied: number;
  balanceDue: number;
  refundDue: number;
};

export function MoveOutButton({
  tenantId,
  moveInDate,
  currencySymbol,
}: {
  tenantId: string;
  moveInDate: string; // ISO date string
  currencySymbol?: string;
}) {
  const router = useRouter();
  const [open, setOpen]             = useState(false);
  const [date, setDate]             = useState(new Date().toISOString().split("T")[0]);
  const [preview, setPreview]       = useState<Preview | null>(null);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [notes, setNotes]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [confirming, setConfirming] = useState(false);

  const fmt = (n: number) => formatCurrency(n, currencySymbol);
  const minDate = new Date(moveInDate).toISOString().split("T")[0];
  const maxDate = new Date().toISOString().split("T")[0];

  // Re-fetch the preview whenever date or deductions change (server owns the math)
  useEffect(() => {
    if (!open) return;
    if (date < minDate || date > maxDate) { setPreview(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/tenants/${tenantId}/settlement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moveOutDate: date,
        preview: true,
        deductions: deductions.map(d => ({ title: d.title, amount: Number(d.amount) })),
      }),
    })
      .then(async res => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { toast.error(json.error ?? "Failed to compute settlement"); setPreview(null); }
        else setPreview(json);
      })
      .catch(() => { if (!cancelled) setPreview(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, date, deductions, tenantId, minDate, maxDate]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveOutDate: date,
          deductions: deductions.map(d => ({ title: d.title, amount: Number(d.amount) })),
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Tenant moved out — settlement recorded");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record settlement");
    } finally {
      setConfirming(false);
    }
  };

  const button = (
    <button
      onClick={() => setOpen(true)}
      className="flex-1 sm:flex-none bg-orange-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-orange-600 transition-colors"
    >
      Move Out
    </button>
  );

  if (!open) return button;

  return (
    <>
      {button}
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Move-out Settlement</h2>
                <p className="text-xs text-slate-400">Final bill, deposit & refund — all in one step</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Move-out date</label>
                <input
                  type="date"
                  value={date}
                  min={minDate}
                  max={maxDate}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {loading && (
                <p className="text-sm text-slate-400 text-center py-3">Calculating settlement…</p>
              )}

              {preview && !loading && (
                <>
                  {/* Final month proration */}
                  {preview.finalMonth && (
                    <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900 rounded-xl px-4 py-3 text-sm">
                      <p className="font-semibold text-orange-800 dark:text-orange-300 mb-0.5">
                        Final period pro-rated: {fmt(preview.finalMonth.proratedDue)}
                      </p>
                      <p className="text-xs text-orange-700/80 dark:text-orange-400/80">
                        {preview.finalMonth.daysOccupied} of {preview.finalMonth.daysInPeriod} days
                        (full period {fmt(preview.finalMonth.baseAmount)})
                        {preview.deletedFutureMonths.length > 0 &&
                          ` · ${preview.deletedFutureMonths.length} future pre-generated bill${preview.deletedFutureMonths.length > 1 ? "s" : ""} will be removed`}
                      </p>
                    </div>
                  )}

                  {/* Outstanding lines */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Outstanding dues</p>
                    {preview.lines.length === 0 ? (
                      <p className="text-sm text-slate-400">No outstanding dues 🎉</p>
                    ) : (
                      <div className="space-y-1.5 text-sm">
                        {preview.lines.map((l, i) => (
                          <div key={i} className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-300">
                              {l.label}
                              {l.type === "deduction" && <span className="text-xs text-slate-400"> (deduction)</span>}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{fmt(l.outstanding)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Deductions editor */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Damage / cleaning deductions</p>
                    <div className="space-y-2">
                      {deductions.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="e.g. Wall repair"
                            value={d.title}
                            onChange={e => setDeductions(ds => ds.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                            className="flex-1 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <input
                            type="number"
                            placeholder="0"
                            min="0"
                            value={d.amount}
                            onChange={e => setDeductions(ds => ds.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                            className="w-28 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <button
                            onClick={() => setDeductions(ds => ds.filter((_, j) => j !== i))}
                            className="text-slate-400 hover:text-rose-500 p-1"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setDeductions(ds => [...ds, { title: "", amount: "" }])}
                        className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
                      >
                        <Plus size={13} /> Add deduction
                      </button>
                    </div>
                  </div>

                  {/* Settlement summary */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Total dues</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{fmt(preview.totalDue)}</span>
                    </div>
                    {preview.creditApplied > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Advance credit applied</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">−{fmt(preview.creditApplied)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Deposit held</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{fmt(preview.depositHeld)}</span>
                    </div>
                    {preview.depositApplied > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Deposit applied to dues</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">−{fmt(preview.depositApplied)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-700 my-1.5" />
                    {preview.refundDue > 0 && (
                      <div className="flex justify-between text-base">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">Refund to tenant</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-400">{fmt(preview.refundDue)}</span>
                      </div>
                    )}
                    {preview.balanceDue > 0 && (
                      <div className="flex justify-between text-base">
                        <span className="font-bold text-rose-600">Tenant still owes</span>
                        <span className="font-black text-rose-600">{fmt(preview.balanceDue)}</span>
                      </div>
                    )}
                    {preview.refundDue === 0 && preview.balanceDue === 0 && (
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 text-center">Fully settled — nothing due either way</p>
                    )}
                  </div>

                  {/* Notes */}
                  <textarea
                    placeholder="Notes (optional) — e.g. refund paid in cash on hand-over"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || loading || !preview}
                className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {confirming ? "Recording…" : "Confirm move-out"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
