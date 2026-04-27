"use client";

import { useState } from "react";
import { Zap, Camera, X, CheckCircle2, Clock, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type PortalReading = {
  id:                string;
  month:             string;
  previous:          number;
  current:           number;
  ratePerUnit:       number;
  unitsUsed:         number;
  amount:            number;
  chargeId:          string | null;
  photoPath:         string | null;
  notes:             string | null;
  status:            string;
  submittedByTenant: boolean;
};

const inputCls = "border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400/60 transition-all w-full";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
}

export function ElectricityPortalClient({
  initialReadings,
  ratePerUnit,
  lastCurrent,
  token,
}: {
  initialReadings: PortalReading[];
  ratePerUnit:     number;
  lastCurrent:     number | null;
  token:           string;
}) {
  const [readings,   setReadings]   = useState<PortalReading[]>(initialReadings);
  const [previous,   setPrevious]   = useState(lastCurrent !== null ? String(lastCurrent) : "");
  const [current,    setCurrent]    = useState("");
  const [notes,      setNotes]      = useState("");
  const [photo,      setPhoto]      = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [expanded,   setExpanded]   = useState<string | null>(null);

  // Edit state
  const [editId,      setEditId]      = useState<string | null>(null);
  const [editPrev,    setEditPrev]    = useState("");
  const [editCurr,    setEditCurr]    = useState("");
  const [editNotes,   setEditNotes]   = useState("");
  const [editSaving,  setEditSaving]  = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const month = currentMonth();
  const hasThisMonth = readings.some(r => r.month === month);

  const prev = parseFloat(previous);
  const curr = parseFloat(current);
  const units = (!isNaN(prev) && !isNaN(curr) && curr >= prev) ? parseFloat((curr - prev).toFixed(2)) : null;
  const estimated = units !== null && ratePerUnit > 0 ? parseFloat((units * ratePerUnit).toFixed(2)) : null;

  const handleSubmit = async () => {
    setError("");
    if (isNaN(prev) || isNaN(curr)) { setError("Enter valid readings"); return; }
    if (curr < prev) { setError("Current cannot be less than previous reading"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/meter-readings", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-portal-token": token },
        body:    JSON.stringify({ month, previous: prev, current: curr, notes: notes.trim() || undefined }),
      });
      const data = await res.json() as PortalReading & { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to submit"); return; }

      // Upload photo if selected
      if (photo) {
        const form = new FormData();
        form.append("photo", photo);
        await fetch(`/api/portal/meter-readings/${data.id}/photo`, { method: "POST", headers: { "x-portal-token": token }, body: form });
        data.photoPath = `${data.id}.jpg`;
      }

      setReadings(prev2 => [data, ...prev2]);
      setCurrent("");
      setNotes("");
      setPhoto(null);
      toast.success("Reading submitted successfully");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (r: PortalReading) => {
    setEditId(r.id);
    setEditPrev(String(r.previous));
    setEditCurr(String(r.current));
    setEditNotes(r.notes ?? "");
    setExpanded(null);
  };

  const handleEditSave = async () => {
    if (!editId) return;
    const p = parseFloat(editPrev);
    const c = parseFloat(editCurr);
    if (isNaN(p) || isNaN(c) || c < p) { toast.error("Check your readings"); return; }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/portal/meter-readings/${editId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-portal-token": token },
        body:    JSON.stringify({ previous: p, current: c, notes: editNotes.trim() || undefined }),
      });
      const data = await res.json() as PortalReading & { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to update"); return; }
      setReadings(prev => prev.map(r => r.id === editId ? { ...r, ...data } : r));
      setEditId(null);
      toast.success("Reading updated");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);

  const confirmDelete = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    setConfirmDeleteId(null);
    setDeleting(id);
    try {
      const res = await fetch(`/api/portal/meter-readings/${id}`, { method: "DELETE", headers: { "x-portal-token": token } });
      if (!res.ok) { const d = await res.json() as { error?: string }; toast.error(d.error ?? "Failed to delete"); return; }
      setReadings(prev => prev.filter(r => r.id !== id));
      toast.success("Reading deleted");
    } finally {
      setDeleting(null);
    }
  };

  const thisMonthReading = readings.find(r => r.month === month);

  return (
    <>
    <ConfirmDialog
      open={!!confirmDeleteId}
      onOpenChange={open => { if (!open) setConfirmDeleteId(null); }}
      title="Delete reading?"
      description="This will permanently delete your meter reading submission. This cannot be undone."
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={confirmDelete}
    />
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Zap size={20} className="text-amber-500" />
          Electricity Reading
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">{monthLabel(month)}</p>
      </div>

      {/* Submit form or current month status */}
      {thisMonthReading ? (
        editId === thisMonthReading.id ? (
          <EditForm
            prev={editPrev} curr={editCurr} notes={editNotes} saving={editSaving}
            onPrev={setEditPrev} onCurr={setEditCurr} onNotes={setEditNotes}
            onSave={handleEditSave} onCancel={() => setEditId(null)}
            ratePerUnit={ratePerUnit}
          />
        ) : (
        <div className={`rounded-2xl border p-5 space-y-3 ${
          thisMonthReading.status === "confirmed"
            ? "bg-emerald-50 border-emerald-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {thisMonthReading.status === "confirmed"
                ? <CheckCircle2 size={16} className="text-emerald-600" />
                : <Clock size={16} className="text-amber-500" />}
              <p className="font-bold text-sm text-slate-800">
                {thisMonthReading.status === "confirmed" ? "Reading confirmed" : "Awaiting landlord review"}
              </p>
            </div>
            {thisMonthReading.status === "pending_review" && (
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(thisMonthReading)} className="flex items-center gap-1 text-xs text-amber-700 font-semibold hover:text-amber-900 transition-colors">
                  <Pencil size={11} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(thisMonthReading.id)}
                  disabled={deleting === thisMonthReading.id}
                  className="flex items-center gap-1 text-xs text-rose-600 font-semibold hover:text-rose-800 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={11} /> {deleting === thisMonthReading.id ? "…" : "Delete"}
                </button>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-600 space-y-0.5">
            <p>Previous: <span className="font-semibold">{thisMonthReading.previous}</span></p>
            <p>Current: <span className="font-semibold">{thisMonthReading.current}</span></p>
            <p>Units used: <span className="font-semibold">{thisMonthReading.unitsUsed}</span></p>
            {thisMonthReading.ratePerUnit > 0 && (
              <p>Estimated: <span className="font-semibold">{thisMonthReading.amount}</span></p>
            )}
          </div>
          {thisMonthReading.chargeId && (
            <p className="text-xs text-emerald-600 font-medium">Charge has been added to your account.</p>
          )}
        </div>
        )
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Submit Reading</h2>
            {ratePerUnit > 0 && (
              <span className="text-xs text-slate-400">{ratePerUnit}/unit (landlord rate)</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Previous</label>
              <input
                type="number" value={previous} min={0}
                onChange={e => setPrevious(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder="Last reading"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Current</label>
              <input
                type="number" value={current} min={0}
                onChange={e => setCurrent(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder="This month"
                className={inputCls}
              />
            </div>
          </div>

          {units !== null && (
            <div className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
              <div className="text-sm text-teal-700">
                <span className="font-bold">{units}</span> units used
              </div>
              {estimated !== null && (
                <div className="text-right">
                  <p className="text-xs text-teal-500">Estimated charge</p>
                  <p className="text-lg font-black text-teal-700">{estimated}</p>
                </div>
              )}
            </div>
          )}

          <input
            type="text" value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className={inputCls}
          />

          {/* Photo */}
          {photo ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-100 rounded-xl">
              <Camera size={13} className="text-teal-500 shrink-0" />
              <span className="text-xs text-teal-700 font-medium flex-1 truncate">{photo.name}</span>
              <button type="button" onClick={() => setPhoto(null)} className="text-slate-400 hover:text-rose-400 transition-colors">
                <X size={13} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-400 hover:text-teal-600 transition-colors">
              <Camera size={13} />
              Attach meter photo (optional)
              <input
                type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(f); e.currentTarget.value = ""; }}
              />
            </label>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || !previous || !current}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Reading"}
          </button>

          {ratePerUnit === 0 && (
            <p className="text-xs text-slate-400 text-center">Rate not set by landlord yet — amount will be calculated after confirmation.</p>
          )}
        </div>
      )}

      {/* History */}
      {readings.filter(r => r.month !== month).length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">History</h2>
          <div className="space-y-2">
            {readings.filter(r => r.month !== month).map(r => (
              editId === r.id ? (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">{monthLabel(r.month)}</p>
                  <EditForm
                    prev={editPrev} curr={editCurr} notes={editNotes} saving={editSaving}
                    onPrev={setEditPrev} onCurr={setEditCurr} onNotes={setEditNotes}
                    onSave={handleEditSave} onCancel={() => setEditId(null)}
                    ratePerUnit={ratePerUnit}
                  />
                </div>
              ) : (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    r.status === "confirmed" ? "bg-emerald-100" : "bg-amber-100"
                  }`}>
                    {r.status === "confirmed"
                      ? <CheckCircle2 size={14} className="text-emerald-600" />
                      : <Clock size={14} className="text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{monthLabel(r.month)}</p>
                    <p className="text-xs text-slate-400">{r.unitsUsed} units · {r.amount > 0 ? `amount: ${r.amount}` : "pending rate"}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    r.status === "confirmed"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-amber-50 text-amber-600 border border-amber-200"
                  }`}>
                    {r.status === "confirmed" ? "Confirmed" : "Pending"}
                  </span>
                  {expanded === r.id ? <ChevronUp size={13} className="text-slate-400 shrink-0" /> : <ChevronDown size={13} className="text-slate-400 shrink-0" />}
                </button>
                {expanded === r.id && (
                  <div className="border-t border-slate-50 px-4 py-3 bg-slate-50/50 text-xs text-slate-600 space-y-0.5">
                    <p>Previous: <span className="font-semibold">{r.previous}</span></p>
                    <p>Current: <span className="font-semibold">{r.current}</span></p>
                    <p>Units: <span className="font-semibold">{r.unitsUsed}</span></p>
                    {r.ratePerUnit > 0 && <p>Rate: <span className="font-semibold">{r.ratePerUnit}/unit</span></p>}
                    {r.chargeId && <p className="text-emerald-600 font-medium mt-1">Charge added to your account</p>}
                    {r.notes && <p className="text-slate-400 mt-1">{r.notes}</p>}
                    {r.photoPath && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/portal/meter-readings/${r.id}/photo?t=${encodeURIComponent(token)}`} alt="Meter" className="mt-2 rounded-xl border border-slate-200 max-w-xs w-full object-cover" />
                    )}
                    {r.status === "pending_review" && (
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                        <button onClick={() => startEdit(r)} className="flex items-center gap-1 text-xs text-amber-700 font-semibold hover:text-amber-900 transition-colors">
                          <Pencil size={11} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deleting === r.id}
                          className="flex items-center gap-1 text-xs text-rose-600 font-semibold hover:text-rose-800 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={11} /> {deleting === r.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )
            ))}
          </div>
        </div>
      )}

      {readings.length === 0 && !hasThisMonth && (
        <div className="text-center py-8 text-sm text-slate-400">
          No readings submitted yet.
        </div>
      )}
    </div>
    </>
  );
}

function EditForm({
  prev, curr, notes, saving,
  onPrev, onCurr, onNotes,
  onSave, onCancel,
  ratePerUnit,
}: {
  prev: string; curr: string; notes: string; saving: boolean;
  onPrev: (v: string) => void; onCurr: (v: string) => void; onNotes: (v: string) => void;
  onSave: () => void; onCancel: () => void;
  ratePerUnit: number;
}) {
  const p = parseFloat(prev);
  const c = parseFloat(curr);
  const units     = (!isNaN(p) && !isNaN(c) && c >= p) ? parseFloat((c - p).toFixed(2)) : null;
  const estimated = units !== null && ratePerUnit > 0 ? parseFloat((units * ratePerUnit).toFixed(2)) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Previous</label>
          <input type="number" value={prev} min={0} onChange={e => onPrev(e.target.value)} onFocus={e => e.target.select()} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Current</label>
          <input type="number" value={curr} min={0} onChange={e => onCurr(e.target.value)} onFocus={e => e.target.select()} className={inputCls} />
        </div>
      </div>
      {units !== null && (
        <div className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5">
          <span className="text-sm text-teal-700 font-bold">{units} units</span>
          {estimated !== null && <span className="text-sm font-black text-teal-700">{estimated}</span>}
        </div>
      )}
      <input type="text" value={notes} onChange={e => onNotes(e.target.value)} placeholder="Notes (optional)" className={inputCls} />
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition-colors">
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200">
          Cancel
        </button>
      </div>
    </div>
  );
}
