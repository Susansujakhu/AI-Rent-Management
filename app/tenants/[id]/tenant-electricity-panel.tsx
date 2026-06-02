"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ChevronDown, ChevronUp, Clock, Pencil, Plus, Trash2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Reading = {
  id: string; tenantId: string; month: string;
  previous: number; current: number; ratePerUnit: number;
  unitsUsed: number; amount: number; chargeId: string | null;
  photoPath: string | null; status: string; submittedByTenant: boolean;
};

const inputCls = "border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/60 transition-all w-full";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
}

export function TenantElectricityPanel({
  tenantId,
  defaultRate,
  globalRate,
  tenantRate,
  currencySymbol,
  canSubmit,
  autoAccept,
  portalEnabled,
}: {
  tenantId:       string;
  defaultRate:    number;   // effective rate = tenant override or global
  globalRate:     number;   // owner's global default
  tenantRate:     number | null; // per-tenant override, if set
  currencySymbol: string;
  canSubmit:      boolean;  // tenant may submit readings via portal
  autoAccept:     boolean;  // submissions auto-confirmed into charges
  portalEnabled:  boolean;  // tenant portal feature enabled at all
}) {
  const router = useRouter();
  const [submit, setSubmit]   = useState(canSubmit);
  const [auto,   setAuto]     = useState(autoAccept);
  const [togglingMeter, setTogglingMeter] = useState(false);
  const [readings,  setReadings]  = useState<Reading[]>([]);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState<string | null>(null);

  // Per-tenant rate override state. Effective rate falls back to the global default.
  const [override,   setOverride]   = useState<number | null>(tenantRate);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput,  setRateInput]  = useState(tenantRate != null ? String(tenantRate) : "");
  const [savingRate, setSavingRate] = useState(false);
  const effectiveRate = (override && override > 0) ? override : globalRate;

  const [form, setForm] = useState({
    month:        currentMonth(),
    readingDate:  new Date().toISOString().split("T")[0],
    previous:     "",
    current:      "",
    rate:         defaultRate > 0 ? String(defaultRate) : "",
    notes:        "",
    createCharge: true,
    photo:        null as File | null,
  });
  const [formError, setFormError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/meter-readings?tenantId=${tenantId}`);
    if (res.ok) setReadings(await res.json());
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Auto-fill previous from latest confirmed reading
  useEffect(() => {
    const latest = [...readings]
      .filter(r => r.status === "confirmed")
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    if (latest) {
      setForm(f => ({ ...f, previous: String(latest.current) }));
    }
  }, [readings]);

  // Keep the local override in sync when the server re-renders with a new
  // tenant rate — e.g. after it's set from the meter-readings toggle elsewhere
  // on the page. (useState only reads the prop on first mount.)
  useEffect(() => { setOverride(tenantRate); }, [tenantRate]);

  const prev = parseFloat(form.previous);
  const curr = parseFloat(form.current);
  const rate = parseFloat(form.rate);
  const calc = (!isNaN(prev) && !isNaN(curr) && curr >= prev && rate > 0)
    ? { units: parseFloat((curr - prev).toFixed(2)), amt: parseFloat(((curr - prev) * rate).toFixed(2)) }
    : null;

  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString()}`;

  const handleSave = async () => {
    setFormError("");
    if (isNaN(prev) || isNaN(curr)) { setFormError("Enter valid readings"); return; }
    if (curr < prev) { setFormError("Current reading cannot be less than previous"); return; }
    if (!form.month) { setFormError("Select a month"); return; }

    setSubmitting(true);
    const res = await fetch("/api/meter-readings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        tenantId,
        month:       form.month,
        readingDate: form.readingDate || null,
        previous:    prev,
        current:     curr,
        ratePerUnit: isNaN(rate) ? 0 : rate,
        notes:       form.notes,
        createCharge: form.createCharge,
      }),
    });
    const data = await res.json() as Reading & { error?: string };
    if (!res.ok) { setFormError(data.error ?? "Failed to save"); setSubmitting(false); return; }

    if (form.photo) {
      setPhotoUploading(data.id);
      const fd = new FormData();
      fd.append("photo", form.photo);
      await fetch(`/api/meter-readings/${data.id}/photo`, { method: "POST", body: fd });
      data.photoPath = `${data.id}.jpg`;
      setPhotoUploading(null);
    }

    setReadings(prev2 => [data, ...prev2]);
    setShowForm(false);
    setForm(f => ({ ...f, previous: String(data.current), current: "", notes: "", photo: null }));
    setSubmitting(false);
    toast.success("Reading saved");
    // A linked charge was created server-side — refresh so the server-rendered
    // Payment Ledger picks up the new electricity charge without a hard reload.
    if (data.chargeId) router.refresh();
  };

  const handleConfirm = async (id: string, createCharge: boolean) => {
    setConfirming(id);
    const res = await fetch(`/api/meter-readings/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "confirmed", createCharge }),
    });
    if (res.ok) {
      const updated: Reading = await res.json();
      setReadings(prev => prev.map(r => r.id === id ? updated : r));
      toast.success("Reading confirmed");
      // Confirming created the linked charge — refresh the server-rendered ledger.
      if (updated.chargeId) router.refresh();
    } else {
      toast.error("Failed to confirm");
    }
    setConfirming(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const hadCharge = readings.find(r => r.id === deleteId)?.chargeId != null;
    const res = await fetch(`/api/meter-readings/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setReadings(prev => prev.filter(r => r.id !== deleteId));
      // Deleting also removes the linked charge — refresh the server ledger.
      if (hadCharge) router.refresh();
    }
    setDeleteId(null);
  };

  // Save (or clear) the per-tenant rate override. Empty input clears it so the
  // tenant falls back to the owner's global rate.
  const saveRate = async () => {
    const v   = rateInput.trim();
    const num = v === "" ? null : Number(v);
    if (num !== null && (!Number.isFinite(num) || num < 0)) {
      toast.error("Enter a valid rate");
      return;
    }
    setSavingRate(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ electricityRate: num }),
      });
      if (!res.ok) { toast.error("Failed to save rate"); return; }
      setOverride(num);
      setEditingRate(false);
      const newEff = (num ?? globalRate);
      setForm(f => ({ ...f, rate: newEff > 0 ? String(newEff) : "" }));
      toast.success(num == null ? "Using global rate" : "Tenant rate updated");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingRate(false);
    }
  };

  const openForm = () => {
    setForm(f => ({ ...f, rate: effectiveRate > 0 ? String(effectiveRate) : "" }));
    setShowForm(true);
  };

  // Enable/disable tenant portal submissions + auto-confirm. Surfaces the
  // server's gate message (e.g. "Add an electricity unit rate first…").
  const updateMeter = async (patch: { canSubmitMeterReading?: boolean; meterReadingAutoAccept?: boolean }) => {
    setTogglingMeter(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(d?.error || "Failed to update setting");
      }
      if (patch.canSubmitMeterReading !== undefined) {
        setSubmit(patch.canSubmitMeterReading);
        toast.success(patch.canSubmitMeterReading ? "Tenant can now submit readings" : "Tenant submissions disabled");
        if (!patch.canSubmitMeterReading && auto) {
          await fetch(`/api/tenants/${tenantId}`, {
            method:  "PUT",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ meterReadingAutoAccept: false }),
          });
          setAuto(false);
        }
      }
      if (patch.meterReadingAutoAccept !== undefined) {
        setAuto(patch.meterReadingAutoAccept);
        toast.success(patch.meterReadingAutoAccept ? "Readings will be auto-confirmed" : "Readings require your review");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update setting");
    } finally {
      setTogglingMeter(false);
    }
  };

  const pending   = readings.filter(r => r.status === "pending_review").sort((a, b) => b.month.localeCompare(a.month));
  const confirmed = readings.filter(r => r.status !== "pending_review").sort((a, b) => b.month.localeCompare(a.month));

  // Show only the latest 2 confirmed readings by default to keep the panel
  // compact. Pending submissions always show in full because they need a
  // decision; only the "history" of past confirmed readings collapses.
  const HISTORY_COUNT  = 2;
  const visibleConfirmed = showAllHistory ? confirmed : confirmed.slice(0, HISTORY_COUNT);
  const hiddenCount      = Math.max(0, confirmed.length - HISTORY_COUNT);

  const existingMonths = new Set(readings.map(r => r.month));

  return (
    <>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => { if (!open) setDeleteId(null); }}
        title="Delete reading?"
        description="This will permanently delete the reading. The linked electricity charge will also be deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-amber-500" />
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Electricity</h2>
            {readings.length > 0 && (
              <span className="text-xs text-slate-400">{readings.length} reading{readings.length !== 1 ? "s" : ""}</span>
            )}
          </div>
          {!showForm && (
            <button
              onClick={openForm}
              disabled={effectiveRate <= 0}
              title={effectiveRate <= 0 ? "Set an electricity rate first" : undefined}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-50 dark:disabled:hover:bg-amber-500/15"
            >
              <Plus size={12} /> Add Reading
            </button>
          )}
        </div>

        {/* Rate strip — the per-unit rate must exist before any reading is added */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
          {editingRate ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rate per unit</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-400">{currencySymbol}</span>
                <input
                  type="number" min={0} step={0.01}
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder={globalRate > 0 ? String(globalRate) : "e.g. 12"}
                  autoFocus
                  className="w-24 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
              <button onClick={saveRate} disabled={savingRate} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-50 transition-colors">
                {savingRate ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setEditingRate(false); setRateInput(override != null ? String(override) : ""); }} className="text-xs font-medium px-2 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                Cancel
              </button>
              {override != null && globalRate > 0 && (
                <button onClick={() => setRateInput("")} className="text-xs text-slate-400 hover:text-amber-600 underline">
                  Use global ({currencySymbol}{globalRate})
                </button>
              )}
            </div>
          ) : effectiveRate > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-800 dark:text-slate-100">{currencySymbol}{effectiveRate}</span>
                <span className="text-slate-400"> / unit</span>
                <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {override && override > 0 ? "tenant-specific" : "global default"}
                </span>
              </p>
              <button
                onClick={() => { setEditingRate(true); setRateInput(override != null ? String(override) : ""); }}
                className="shrink-0 flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-amber-600 dark:text-slate-400 transition-colors"
              >
                <Pencil size={11} /> Change
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Set an electricity rate to start adding readings.</p>
              <button
                onClick={() => { setEditingRate(true); setRateInput(""); }}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white transition-colors"
              >
                Set rate
              </button>
            </div>
          )}
        </div>

        {/* Tenant submissions — enable portal readings + auto-confirm, gated on the rate above */}
        {portalEnabled && (
          <div className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${submit ? "bg-amber-50 dark:bg-amber-500/15" : "bg-slate-50 dark:bg-slate-800"}`}>
                  <Zap size={14} className={submit ? "text-amber-500" : "text-slate-400"} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tenant submissions</p>
                  <p className="text-xs text-slate-400">
                    {submit
                      ? "Tenant can submit readings via portal"
                      : effectiveRate > 0
                        ? "Tenant cannot submit readings"
                        : "Set a rate above to enable"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateMeter({ canSubmitMeterReading: !submit })}
                disabled={togglingMeter || (effectiveRate <= 0 && !submit)}
                title={effectiveRate <= 0 && !submit ? "Set an electricity rate first" : undefined}
                className={`relative w-11 h-6 rounded-full transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${submit ? "bg-amber-500" : "bg-slate-200 dark:bg-slate-700"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${submit ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            {submit && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="pl-11">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Auto-confirm readings</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {auto ? "Charges created automatically on submission" : "You review each reading before it's charged"}
                  </p>
                </div>
                <button
                  onClick={() => updateMeter({ meterReadingAutoAccept: !auto })}
                  disabled={togglingMeter}
                  className={`relative w-9 h-5 rounded-full transition-all duration-200 focus:outline-none disabled:opacity-50 shrink-0 ${auto ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${auto ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Add Reading Form */}
        {showForm && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-amber-50/30 dark:bg-amber-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">New Reading</p>
              <button onClick={() => { setShowForm(false); setFormError(""); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Month + Reading Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Month</label>
                <input
                  type="month"
                  value={form.month}
                  onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                  className={inputCls + (existingMonths.has(form.month) ? " border-rose-300" : "")}
                />
                {existingMonths.has(form.month) && (
                  <p className="text-xs text-rose-500 mt-1">A reading already exists for this month</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Reading Date</label>
                <input
                  type="date"
                  value={form.readingDate}
                  onChange={e => setForm(f => ({ ...f, readingDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Previous / Current */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Previous</label>
                <input
                  type="number" min={0} placeholder="Last reading"
                  value={form.previous}
                  onChange={e => setForm(f => ({ ...f, previous: e.target.value }))}
                  onFocus={e => e.target.select()}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Current</label>
                <input
                  type="number" min={0} placeholder="This reading"
                  value={form.current}
                  onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
                  onFocus={e => e.target.select()}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Rate */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Rate per Unit</label>
              <input
                type="number" min={0} step={0.01} placeholder="e.g. 12"
                value={form.rate}
                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                onFocus={e => e.target.select()}
                className={inputCls}
              />
            </div>

            {/* Calculated result */}
            {calc && (
              <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/20 rounded-xl px-3 py-2.5">
                <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">{calc.units} units</span>
                <span className="text-base text-amber-900 dark:text-amber-300 font-black">{fmt(calc.amt)}</span>
              </div>
            )}

            {/* Create charge checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.createCharge}
                onChange={e => setForm(f => ({ ...f, createCharge: e.target.checked }))}
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Auto-create one-time charge</span>
            </label>

            {/* Notes */}
            <input
              type="text"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className={inputCls}
            />

            {/* Photo */}
            {form.photo ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl">
                <Camera size={13} className="text-amber-500 shrink-0" />
                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium flex-1 truncate">{form.photo.name}</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, photo: null }))} className="text-slate-400 hover:text-rose-400 transition-colors">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-400 hover:text-amber-600 transition-colors w-fit">
                <Camera size={13} />
                Attach meter photo (optional)
                <input
                  type="file" accept="image/*" capture="environment" className="hidden"
                  ref={photoInputRef}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setForm(prev => ({ ...prev, photo: f }));
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            )}

            {formError && <p className="text-xs text-rose-600">{formError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={submitting || existingMonths.has(form.month) || !form.previous || !form.current}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {submitting ? "Saving…" : "Save Reading"}
              </button>
              <button
                onClick={() => { setShowForm(false); setFormError(""); }}
                className="px-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Pending review */}
        {pending.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map(r => (
              <div key={r.id} className="border-l-4 border-amber-400">
                <div className="px-5 py-3.5 flex items-center gap-3">
                  <Clock size={14} className="text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{monthLabel(r.month)}</p>
                    <p className="text-xs text-slate-400">
                      {r.previous} → {r.current} · <span className="font-semibold">{r.unitsUsed} units</span>
                      {r.ratePerUnit > 0 && <span className="text-slate-600 dark:text-slate-300 ml-1 font-semibold">= {fmt(r.amount)}</span>}
                      <span className="ml-2 text-amber-500">· submitted by tenant</span>
                    </p>
                  </div>
                  <button onClick={() => setDeleteId(r.id)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
                {r.photoPath && (
                  <div className="px-5 pb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/meter-readings/${r.id}/photo`} alt="Meter" className="w-full max-w-xs rounded-xl border border-slate-200 object-cover" />
                  </div>
                )}
                <div className="px-5 pb-3.5 flex gap-2">
                  <button
                    onClick={() => handleConfirm(r.id, true)}
                    disabled={confirming === r.id}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-2 rounded-xl text-xs font-semibold transition-colors"
                  >
                    {confirming === r.id ? "Confirming…" : "Confirm & Create Charge"}
                  </button>
                  <button
                    onClick={() => handleConfirm(r.id, false)}
                    disabled={confirming === r.id}
                    className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {confirming === r.id ? "Confirming…" : "Confirm (no charge)"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Confirmed readings */}
        {confirmed.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleConfirmed.map(r => (
              <div key={r.id}>
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <CheckCircle2 size={15} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{monthLabel(r.month)}</p>
                    <p className="text-xs text-slate-400">
                      {r.unitsUsed} units · {r.ratePerUnit}/unit ·{" "}
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{fmt(r.amount)}</span>
                      {r.chargeId && <span className="text-emerald-600 dark:text-emerald-400 ml-1.5">· charge created</span>}
                      {r.submittedByTenant && <span className="text-blue-500 ml-1.5">· by tenant</span>}
                    </p>
                  </div>
                  {expanded === r.id ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                </button>

                {expanded === r.id && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/40 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                        <p>Previous reading: <span className="font-semibold">{r.previous}</span></p>
                        <p>Current reading: <span className="font-semibold">{r.current}</span></p>
                        <p>Units used: <span className="font-semibold">{r.unitsUsed}</span></p>
                        <p>Rate: <span className="font-semibold">{r.ratePerUnit}/unit</span></p>
                      </div>
                      <button onClick={() => setDeleteId(r.id)} className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-medium transition-colors">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>

                    {r.photoPath ? (
                      <div className="space-y-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/meter-readings/${r.id}/photo`} alt="Meter" className="w-full max-w-xs rounded-xl border border-slate-200 object-cover" />
                        <button
                          onClick={async () => {
                            await fetch(`/api/meter-readings/${r.id}/photo`, { method: "DELETE" });
                            setReadings(prev => prev.map(x => x.id === r.id ? { ...x, photoPath: null } : x));
                          }}
                          className="text-[11px] text-rose-400 hover:text-rose-600 transition-colors"
                        >
                          Remove photo
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-400 hover:text-amber-600 transition-colors w-fit">
                        <Camera size={12} />
                        {photoUploading === r.id ? "Uploading…" : "Add meter photo"}
                        <input
                          type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={async e => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setPhotoUploading(r.id);
                            const fd = new FormData();
                            fd.append("photo", f);
                            await fetch(`/api/meter-readings/${r.id}/photo`, { method: "POST", body: fd });
                            setReadings(prev => prev.map(x => x.id === r.id ? { ...x, photoPath: `${r.id}.jpg` } : x));
                            setPhotoUploading(null);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllHistory(s => !s)}
                className="w-full px-5 py-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 transition-colors"
              >
                {showAllHistory ? "Hide history" : `Show ${hiddenCount} more ${hiddenCount === 1 ? "reading" : "readings"}`}
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {readings.length === 0 && !showForm && (
          <div className="py-10 text-center">
            <Zap size={28} className="mx-auto mb-2 text-slate-200 dark:text-slate-700" />
            <p className="text-sm text-slate-400 font-medium">No readings yet</p>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-0.5">Add a reading to track electricity usage</p>
          </div>
        )}
      </div>
    </>
  );
}
