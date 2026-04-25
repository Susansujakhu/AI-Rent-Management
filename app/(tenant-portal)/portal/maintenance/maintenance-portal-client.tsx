"use client";

import { useState } from "react";
import { Plus, X, Hammer, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

type MReq = {
  id:          string;
  title:       string;
  description: string | null;
  category:    string;
  priority:    string;
  status:      string;
  notes:       string | null;
  resolvedAt:  string | null;
  createdAt:   string;
};

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: "Plumbing", ELECTRICAL: "Electrical", APPLIANCE: "Appliance",
  STRUCTURAL: "Structural", PEST: "Pest", OTHER: "Other",
};

const PRIORITY_CLS: Record<string, string> = {
  LOW:    "bg-slate-100 text-slate-600",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH:   "bg-orange-100 text-orange-700",
  URGENT: "bg-rose-100 text-rose-700",
};

const STATUS_CONFIG: Record<string, { cls: string; icon: typeof Clock; label: string }> = {
  OPEN:        { cls: "bg-blue-50 text-blue-700 border-blue-200",       icon: Clock,         label: "Open" },
  IN_PROGRESS: { cls: "bg-amber-50 text-amber-700 border-amber-200",    icon: Clock,         label: "In Progress" },
  RESOLVED:    { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "Resolved" },
  CLOSED:      { cls: "bg-slate-50 text-slate-600 border-slate-200",    icon: AlertCircle,   label: "Closed" },
};

const inputCls =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400/60 placeholder:text-slate-400 transition-all";

export function MaintenancePortalClient({ initial }: { initial: MReq[] }) {
  const [requests, setRequests] = useState<MReq[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [error, setError]           = useState("");

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState("OTHER");
  const [priority,    setPriority]    = useState("MEDIUM");

  const resetForm = () => {
    setTitle(""); setDescription(""); setCategory("OTHER"); setPriority("MEDIUM");
    setError(""); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/portal/maintenance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: title.trim(), description: description.trim(), category, priority }),
      });
      const data = await res.json() as MReq & { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to submit"); return; }
      setRequests(prev => [data, ...prev]);
      resetForm();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-sm text-slate-400 mt-0.5">{requests.length} request{requests.length !== 1 ? "s" : ""}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-teal-200">
            <Plus size={15} /> New Request
          </button>
        )}
      </div>

      {/* Submit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold text-slate-800">New Maintenance Request</h2>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Leaking tap in kitchen"
              autoFocus
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue in detail…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                <option value="PLUMBING">Plumbing</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="APPLIANCE">Appliance</option>
                <option value="STRUCTURAL">Structural</option>
                <option value="PEST">Pest</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
              <p className="text-rose-600 text-xs">{error}</p>
            </div>
          )}

          <button type="submit" disabled={submitting || !title.trim()}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      )}

      {/* Requests list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {requests.length === 0 ? (
          <div className="py-14 text-center">
            <Hammer size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">No requests yet</p>
            <p className="text-xs text-slate-400 mt-1">Tap &ldquo;New Request&rdquo; to report an issue.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {requests.map(req => {
              const cfg = STATUS_CONFIG[req.status];
              const StatusIcon = cfg?.icon ?? Clock;
              return (
                <div key={req.id}>
                  <button
                    onClick={() => setExpanded(expanded === req.id ? null : req.id)}
                    className="w-full px-4 py-4 flex items-start gap-3 text-left hover:bg-slate-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg?.cls}`}>
                          {cfg?.label ?? req.status}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${PRIORITY_CLS[req.priority]}`}>
                          {req.priority}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          {CATEGORY_LABELS[req.category] ?? req.category}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{req.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="mt-1 shrink-0 text-slate-400">
                      {expanded === req.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>

                  {expanded === req.id && (
                    <div className="px-4 pb-4 space-y-3 bg-slate-50/40 border-t border-slate-50">
                      {req.description && (
                        <div className="pt-3">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Your description</p>
                          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{req.description}</p>
                        </div>
                      )}
                      {req.notes ? (
                        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Landlord response</p>
                          <p className="text-sm text-teal-800 leading-relaxed">{req.notes}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 pt-2">No response from landlord yet.</p>
                      )}
                      {req.resolvedAt && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          Resolved on {new Date(req.resolvedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
