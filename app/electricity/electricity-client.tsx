"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Zap, Plus, Trash2, CheckCircle2, ChevronDown, ChevronUp, Save, Camera, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Tenant = { id: string; name: string; room: { name: string } | null };
type Reading = {
  id: string; tenantId: string; month: string;
  previous: number; current: number; ratePerUnit: number;
  unitsUsed: number; amount: number; chargeId: string | null;
  photoPath: string | null; status: string; submittedByTenant: boolean;
  tenant: { id: string; name: string; room: { name: string } | null };
};

const inputCls = "border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/60 transition-all w-full";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ElectricityClient({
  tenants,
  defaultRate,
}: {
  tenants:     Tenant[];
  defaultRate: number;
}) {
  const [month,     setMonth]     = useState(currentMonth());
  const [rate,      setRate]      = useState(defaultRate);
  const [readings,  setReadings]  = useState<Reading[]>([]);
  const [showForm,  setShowForm]  = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState<string | null>(null);
  const [savingRate,   setSavingRate]   = useState(false);
  const [rateSaved,    setRateSaved]    = useState(false);
  const [error,        setError]        = useState<Record<string, string>>({});

  const [forms, setForms] = useState<Record<string, { previous: string; current: string; notes: string; createCharge: boolean; photo: File | null }>>({});
  const [lastCurrent, setLastCurrent] = useState<Record<string, number>>({});
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>({});
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [pendingReviews, setPendingReviews] = useState<Reading[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteReadingId, setDeleteReadingId] = useState<string | null>(null);

  const loadReadings = useCallback(async () => {
    const res = await fetch(`/api/meter-readings?month=${month}`);
    if (res.ok) {
      const all: Reading[] = await res.json();
      setReadings(all.filter(r => r.status !== "pending_review"));
      setPendingReviews(all.filter(r => r.status === "pending_review"));
    }
  }, [month]);

  useEffect(() => { loadReadings(); }, [loadReadings]);

  useEffect(() => {
    fetch("/api/meter-readings?latest=1")
      .then(r => r.ok ? r.json() : [])
      .then((data: Reading[]) => {
        const map: Record<string, number> = {};
        for (const r of data) map[r.tenantId] = r.current;
        setLastCurrent(map);
      });
  }, []);

  const readingForTenant = (tenantId: string) => readings.find(r => r.tenantId === tenantId);

  const openForm = (tenantId: string) => {
    setShowForm(tenantId);
    if (!forms[tenantId]) {
      const prevReading = lastCurrent[tenantId];
      setForms(prev => ({
        ...prev,
        [tenantId]: {
          previous:     prevReading !== undefined ? String(prevReading) : "",
          current:      "",
          notes:        "",
          createCharge: true,
          photo:        null,
        },
      }));
    }
  };

  const setField = (tenantId: string, field: string, value: string | boolean) =>
    setForms(prev => ({ ...prev, [tenantId]: { ...prev[tenantId], [field]: value } }));

  const calc = (tenantId: string) => {
    const f = forms[tenantId];
    if (!f) return null;
    const prev = parseFloat(f.previous);
    const curr = parseFloat(f.current);
    if (!isNaN(prev) && !isNaN(curr) && curr >= prev && rate > 0) {
      const units = parseFloat((curr - prev).toFixed(2));
      const amt   = parseFloat((units * rate).toFixed(2));
      return { units, amt };
    }
    return null;
  };

  const handleSaveRate = async () => {
    setSavingRate(true);
    await fetch("/api/settings", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ electricityRate: String(rate) }),
    });
    setSavingRate(false);
    setRateSaved(true);
    setTimeout(() => setRateSaved(false), 2000);
  };

  const handleSave = async (tenantId: string) => {
    const f = forms[tenantId];
    setError(prev => ({ ...prev, [tenantId]: "" }));
    const prev = parseFloat(f.previous);
    const curr = parseFloat(f.current);
    if (isNaN(prev) || isNaN(curr)) { setError(prev2 => ({ ...prev2, [tenantId]: "Enter valid readings" })); return; }
    if (curr < prev) { setError(p => ({ ...p, [tenantId]: "Current cannot be less than previous" })); return; }

    setSubmitting(tenantId);
    const res = await fetch("/api/meter-readings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ tenantId, month, previous: prev, current: curr, ratePerUnit: rate, notes: f.notes, createCharge: f.createCharge }),
    });
    const data = await res.json() as Reading & { error?: string };
    if (!res.ok) { setError(p => ({ ...p, [tenantId]: data.error ?? "Failed to save" })); setSubmitting(null); return; }
    // Upload photo if selected
    const photoFile = forms[tenantId]?.photo;
    if (photoFile) {
      setPhotoUploading(p => ({ ...p, [tenantId]: true }));
      const form = new FormData();
      form.append("photo", photoFile);
      await fetch(`/api/meter-readings/${data.id}/photo`, { method: "POST", body: form });
      data.photoPath = `${data.id}.jpg`;
      setPhotoUploading(p => ({ ...p, [tenantId]: false }));
    }

    setReadings(prev2 => [...prev2, data]);
    setLastCurrent(prev => ({ ...prev, [tenantId]: data.current }));
    setShowForm(null);
    setSubmitting(null);
  };

  const handleDelete = (readingId: string) => setDeleteReadingId(readingId);

  const confirmDeleteReading = async () => {
    if (!deleteReadingId) return;
    const res = await fetch(`/api/meter-readings/${deleteReadingId}`, { method: "DELETE" });
    if (res.ok) setReadings(prev => prev.filter(r => r.id !== deleteReadingId));
    setDeleteReadingId(null);
  };

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
  };

  const handleConfirm = async (readingId: string, createCharge: boolean) => {
    setConfirming(readingId);
    const res = await fetch(`/api/meter-readings/${readingId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "confirmed", createCharge }),
    });
    if (res.ok) {
      const updated: Reading = await res.json();
      setPendingReviews(prev => prev.filter(r => r.id !== readingId));
      setReadings(prev => [...prev, updated]);
      setLastCurrent(prev => ({ ...prev, [updated.tenantId]: updated.current }));
      toast.success("Reading confirmed");
    } else {
      toast.error("Failed to confirm reading");
    }
    setConfirming(null);
  };

  const activeTenants = tenants.filter(t => !readingForTenant(t.id) && !pendingReviews.find(r => r.tenantId === t.id));
  const doneCount     = readings.length;

  return (
    <>
    <ConfirmDialog
      open={!!deleteReadingId}
      onOpenChange={open => { if (!open) setDeleteReadingId(null); }}
      title="Delete reading?"
      description="This will permanently delete the reading. The linked electricity charge will also be deleted."
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={confirmDeleteReading}
    />
    <div className="space-y-6">

      {/* Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Billing Period & Rate</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Month</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Rate per Unit
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={rate === 0 ? "" : rate}
                onChange={e => setRate(parseFloat(e.target.value) || 0)}
                onFocus={e => e.target.select()}
                min={0} step={0.01} placeholder="e.g. 12"
                className={inputCls}
              />
              <button
                onClick={handleSaveRate}
                disabled={savingRate || rate === 0}
                title="Save as default rate"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
              >
                {rateSaved ? <><CheckCircle2 size={13} className="text-emerald-600" /> Saved</> : <><Save size={13} /> Save Rate</>}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Zap size={12} className="text-amber-500" />
          <span>{doneCount} of {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} recorded for {monthLabel(month)}</span>
        </div>
      </div>

      {/* Tenant-submitted readings awaiting review */}
      {pendingReviews.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={13} className="text-amber-500" />
            <h2 className="text-xs font-bold text-amber-600 uppercase tracking-widest">Awaiting Review ({pendingReviews.length})</h2>
          </div>
          <div className="space-y-2">
            {pendingReviews.map(r => (
              <div key={r.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-500/30 overflow-hidden">
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Clock size={13} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {r.tenant.name}
                      {r.tenant.room && <span className="text-slate-400 font-normal"> · {r.tenant.room.name}</span>}
                      <span className="ml-2 text-xs font-normal text-amber-500">submitted by tenant</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {r.previous} → {r.current} · <span className="font-semibold">{r.unitsUsed} units</span>
                      {r.ratePerUnit > 0 && <span className="text-slate-600 dark:text-slate-300 ml-1 font-semibold">= {r.amount}</span>}
                    </p>
                  </div>
                </div>
                <div className="border-t border-amber-100 dark:border-amber-500/20 px-4 py-3 bg-amber-50/40 dark:bg-amber-500/5 flex items-center gap-2">
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
                    className="flex-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2 rounded-xl text-xs font-semibold transition-colors"
                  >
                    {confirming === r.id ? "Confirming…" : "Confirm (no charge)"}
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {r.photoPath && (
                  <div className="px-4 pb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/meter-readings/${r.id}/photo`} alt="Meter" className="w-full max-w-xs rounded-xl border border-slate-200 object-cover" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recorded readings */}
      {readings.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recorded</h2>
          <div className="space-y-2">
            {readings.map(r => (
              <div key={r.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 overflow-hidden">
                <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {r.tenant.name}
                      {r.tenant.room && <span className="text-slate-400 font-normal"> · {r.tenant.room.name}</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {r.unitsUsed} units · {r.ratePerUnit}/unit ·{" "}
                      <span className="font-semibold text-slate-600">{r.amount}</span>
                      {r.chargeId && <span className="text-emerald-600 ml-1">· charge created</span>}
                    </p>
                  </div>
                  {expanded === r.id ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                </button>
                {expanded === r.id && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3.5 bg-slate-50/40 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                        <p>Previous reading: <span className="font-semibold">{r.previous}</span></p>
                        <p>Current reading: <span className="font-semibold">{r.current}</span></p>
                        <p>Units used: <span className="font-semibold">{r.unitsUsed}</span></p>
                        <p>Rate: <span className="font-semibold">{r.ratePerUnit}/unit</span></p>
                      </div>
                      <button onClick={() => handleDelete(r.id)}
                        className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-medium transition-colors">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                    {r.photoPath ? (
                      <div className="space-y-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/meter-readings/${r.id}/photo`} alt="Meter" className="w-full max-w-xs rounded-xl border border-slate-200 object-cover" />
                        <button onClick={async () => {
                          await fetch(`/api/meter-readings/${r.id}/photo`, { method: "DELETE" });
                          setReadings(prev => prev.map(x => x.id === r.id ? { ...x, photoPath: null } : x));
                        }} className="text-[11px] text-rose-400 hover:text-rose-600 transition-colors">
                          Remove photo
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-400 hover:text-amber-600 transition-colors w-fit">
                        <Camera size={12} />
                        {photoUploading[r.id] ? "Uploading…" : "Add meter photo"}
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={async e => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setPhotoUploading(p => ({ ...p, [r.id]: true }));
                            const form = new FormData();
                            form.append("photo", f);
                            await fetch(`/api/meter-readings/${r.id}/photo`, { method: "POST", body: form });
                            setReadings(prev => prev.map(x => x.id === r.id ? { ...x, photoPath: `${r.id}.jpg` } : x));
                            setPhotoUploading(p => ({ ...p, [r.id]: false }));
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending tenants */}
      {activeTenants.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Pending ({activeTenants.length})
          </h2>
          <div className="space-y-2">
            {activeTenants.map(tenant => {
              const isOpen = showForm === tenant.id;
              const result = calc(tenant.id);
              return (
                <div key={tenant.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="px-4 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {tenant.name}
                        {tenant.room && <span className="text-slate-400 font-normal text-xs"> · {tenant.room.name}</span>}
                      </p>
                    </div>
                    <button onClick={() => isOpen ? setShowForm(null) : openForm(tenant.id)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        isOpen ? "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700" : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30"
                      }`}>
                      {isOpen ? "Cancel" : <><Plus size={12} /> Add Reading</>}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-4 space-y-3 bg-slate-50/40 dark:bg-slate-800/40">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Previous</label>
                          <input type="number" value={forms[tenant.id]?.previous ?? ""} min={0}
                            onChange={e => setField(tenant.id, "previous", e.target.value)}
                            onFocus={e => e.target.select()}
                            placeholder="Last month's reading" className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Current</label>
                          <input type="number" value={forms[tenant.id]?.current ?? ""} min={0}
                            onChange={e => setField(tenant.id, "current", e.target.value)}
                            onFocus={e => e.target.select()}
                            placeholder="This month's reading" className={inputCls} />
                        </div>
                      </div>

                      {result && (
                        <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/20 rounded-xl px-3 py-2.5 text-sm">
                          <span className="text-amber-700 dark:text-amber-400 font-medium">{result.units} units</span>
                          <span className="text-amber-900 dark:text-amber-300 font-black text-base">{result.amt}</span>
                        </div>
                      )}

                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={forms[tenant.id]?.createCharge ?? true}
                          onChange={e => setField(tenant.id, "createCharge", e.target.checked)}
                          className="w-4 h-4 accent-amber-500 rounded" />
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Auto-create one-time charge for tenant</span>
                      </label>

                      <input type="text" value={forms[tenant.id]?.notes ?? ""}
                        onChange={e => setField(tenant.id, "notes", e.target.value)}
                        placeholder="Notes (optional)" className={inputCls} />

                      {/* Meter photo */}
                      <div>
                        {forms[tenant.id]?.photo ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                            <Camera size={13} className="text-amber-500 shrink-0" />
                            <span className="text-xs text-amber-700 font-medium flex-1 truncate">{forms[tenant.id].photo!.name}</span>
                            <button type="button" onClick={() => setField(tenant.id, "photo", null as unknown as string)}
                              className="text-slate-400 hover:text-rose-400 transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-500 hover:text-amber-600 transition-colors">
                            <Camera size={13} />
                            Attach meter photo (optional)
                            <input
                              type="file" accept="image/*" capture="environment" className="hidden"
                              ref={el => { photoInputRefs.current[tenant.id] = el; }}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) setField(tenant.id, "photo", f as unknown as string);
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {error[tenant.id] && (
                        <p className="text-xs text-rose-600">{error[tenant.id]}</p>
                      )}

                      <button onClick={() => handleSave(tenant.id)} disabled={submitting === tenant.id || !forms[tenant.id]?.previous || !forms[tenant.id]?.current}
                        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                        {submitting === tenant.id ? "Saving…" : "Save Reading"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tenants.length === 0 && (
        <div className="text-center py-16">
          <Zap size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No active tenants</p>
          <p className="text-xs text-slate-400 mt-1">Add tenants first to track electricity usage.</p>
        </div>
      )}
    </div>
    </>
  );
}
