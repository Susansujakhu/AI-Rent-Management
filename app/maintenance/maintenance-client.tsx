"use client";

import { useState } from "react";
import { Hammer, ChevronDown, ChevronUp } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type MRequest = {
  id:          string;
  title:       string;
  description: string | null;
  category:    string;
  priority:    string;
  status:      string;
  notes:       string | null;
  resolvedAt:  string | null;
  createdAt:   string;
  tenant: { id: string; name: string; room: { name: string } | null };
};

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: "Plumbing", ELECTRICAL: "Electrical", APPLIANCE: "Appliance",
  STRUCTURAL: "Structural", PEST: "Pest", OTHER: "Other",
};

const PRIORITY_CLS: Record<string, string> = {
  LOW:    "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400",
  MEDIUM: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
  HIGH:   "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  URGENT: "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400",
};

const STATUS_CLS: Record<string, string> = {
  OPEN:        "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
  RESOLVED:    "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  CLOSED:      "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400",
};

const TABS = [
  { key: "ALL",         label: "All" },
  { key: "OPEN",        label: "Open" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED",    label: "Resolved" },
  { key: "CLOSED",      label: "Closed" },
];

export function MaintenanceClient({ initial }: { initial: MRequest[] }) {
  const [requests, setRequests] = useState<MRequest[]>(initial);
  const [filter,   setFilter]   = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [form, setForm]         = useState<Record<string, { status: string; notes: string }>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const counts = {
    ALL:         requests.length,
    OPEN:        requests.filter(r => r.status === "OPEN").length,
    IN_PROGRESS: requests.filter(r => r.status === "IN_PROGRESS").length,
    RESOLVED:    requests.filter(r => r.status === "RESOLVED").length,
    CLOSED:      requests.filter(r => r.status === "CLOSED").length,
  };

  const filtered = filter === "ALL" ? requests : requests.filter(r => r.status === filter);

  const openEdit = (req: MRequest) => {
    if (expanded === req.id) { setExpanded(null); return; }
    setExpanded(req.id);
    setForm(prev => ({
      ...prev,
      [req.id]: prev[req.id] ?? { status: req.status, notes: req.notes ?? "" },
    }));
  };

  const setField = (id: string, field: "status" | "notes", value: string) =>
    setForm(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleUpdate = async (id: string) => {
    setUpdating(id);
    const { status, notes } = form[id] ?? {};
    const res = await fetch(`/api/maintenance/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status, notes }),
    });
    if (res.ok) {
      const updated = await res.json() as MRequest;
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
    }
    setUpdating(null);
  };

  const handleDelete = (id: string) => setDeleteId(id);

  const confirmDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/maintenance/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setRequests(prev => prev.filter(r => r.id !== deleteId));
      if (expanded === deleteId) setExpanded(null);
    }
    setDeleteId(null);
  };

  return (
    <>
    <ConfirmDialog
      open={!!deleteId}
      onOpenChange={open => { if (!open) setDeleteId(null); }}
      title="Delete request?"
      description="This will permanently delete the maintenance request. This cannot be undone."
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={confirmDelete}
    />
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Open",        count: counts.OPEN,        cls: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20" },
          { label: "In Progress", count: counts.IN_PROGRESS, cls: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20" },
          { label: "Resolved",    count: counts.RESOLVED,    cls: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20" },
          { label: "Closed",      count: counts.CLOSED,      cls: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{s.label}</p>
            <p className={`text-2xl font-black mt-0.5 ${s.cls}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex-wrap">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === tab.key
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}>
            {tab.label}
            {counts[tab.key as keyof typeof counts] > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filter === tab.key ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400" : "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400"
              }`}>
                {counts[tab.key as keyof typeof counts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Hammer size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No requests</p>
          <p className="text-xs mt-1 text-slate-400">
            {filter === "ALL"
              ? "Tenants can submit requests via their portal."
              : `No ${filter.toLowerCase().replace("_", " ")} requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(req => (
            <div key={req.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              {/* Card header */}
              <button onClick={() => openEdit(req)}
                className="w-full px-4 py-4 flex items-start gap-3 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_CLS[req.status]}`}>
                      {req.status.replace("_", " ")}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${PRIORITY_CLS[req.priority]}`}>
                      {req.priority}
                    </span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                      {CATEGORY_LABELS[req.category] ?? req.category}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{req.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {req.tenant.name}
                    {req.tenant.room ? ` · ${req.tenant.room.name}` : ""}
                    {" · "}
                    {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                  {req.description && expanded !== req.id && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{req.description}</p>
                  )}
                </div>
                {expanded === req.id
                  ? <ChevronUp size={15} className="text-slate-400 mt-1 shrink-0" />
                  : <ChevronDown size={15} className="text-slate-400 mt-1 shrink-0" />}
              </button>

              {/* Expanded panel */}
              {expanded === req.id && (
                <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-4 space-y-4 bg-slate-50/40 dark:bg-slate-800/40">
                  {req.description && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{req.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                        Status
                      </label>
                      <select
                        value={form[req.id]?.status ?? req.status}
                        onChange={e => setField(req.id, "status", e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400/50">
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                      Response / Notes
                    </label>
                    <textarea
                      rows={3}
                      value={form[req.id]?.notes ?? ""}
                      onChange={e => setField(req.id, "notes", e.target.value)}
                      placeholder="Add a response or internal note visible to the tenant…"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/50 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button onClick={() => handleDelete(req.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-medium transition-colors">
                      Delete request
                    </button>
                    <button
                      onClick={() => handleUpdate(req.id)}
                      disabled={updating === req.id}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                      {updating === req.id ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
