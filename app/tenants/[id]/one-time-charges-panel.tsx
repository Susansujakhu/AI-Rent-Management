"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Trash2, X, Check, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface SerializedCharge {
  id: string;
  title: string;
  amount: number;
  amountPaid: number;
  date: string;
  status: string;
  notes: string | null;
}

// ── Paginator ─────────────────────────────────────────────────────────────────

function Paginator({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);
  const pages: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pages.push(i);
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-slate-50/60">
      <span className="text-xs text-slate-400">{start}–{end} of {total}</span>
      <div className="flex items-center gap-0.5">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={14} />
        </button>
        {pages[0] > 1 && <span className="px-1 text-slate-300 text-xs">…</span>}
        {pages.map(p => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-7 h-7 text-xs font-semibold rounded-lg transition-colors ${
              p === page ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-200"
            }`}>
            {p}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages && <span className="px-1 text-slate-300 text-xs">…</span>}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID:    "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20",
    PARTIAL: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20",
    PENDING: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20",
    OVERDUE: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20",
  };
  const dots: Record<string, string> = {
    PAID: "bg-emerald-500", PARTIAL: "bg-blue-500", PENDING: "bg-amber-400", OVERDUE: "bg-rose-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? "bg-slate-400"}`} />
      {status}
    </span>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  charge,
  onClose,
  onSaved,
}: {
  charge: SerializedCharge;
  onClose: () => void;
  onSaved: (updated: SerializedCharge) => void;
}) {
  const [title,   setTitle]   = useState(charge.title);
  const [amount,  setAmount]  = useState(String(charge.amount));
  const [date,    setDate]    = useState(charge.date.split("T")[0]);
  const [notes,   setNotes]   = useState(charge.notes ?? "");
  const [saving,  setSaving]  = useState(false);

  // field errors
  const [titleErr,  setTitleErr]  = useState("");
  const [amountErr, setAmountErr] = useState("");
  const [dateErr,   setDateErr]   = useState("");

  const field = "w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-slate-200";
  const lbl   = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1";
  const err   = "text-rose-500 text-xs mt-1";

  const handleSave = async () => {
    setTitleErr(""); setAmountErr(""); setDateErr("");
    let valid = true;
    if (!title.trim())             { setTitleErr("Description is required"); valid = false; }
    if (!amount || Number(amount) <= 0) { setAmountErr("Enter a valid amount greater than 0"); valid = false; }
    if (!date)                     { setDateErr("Date is required"); valid = false; }
    if (!valid) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/one-time-charges/${charge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), amount: Number(amount), date, notes: notes || null }),
      });
      const body = await res.json() as { error?: string } & Partial<SerializedCharge>;
      if (!res.ok) throw new Error(body.error ?? "Failed to update");
      toast.success("Charge updated");
      onSaved({
        id:        charge.id,
        title:     body.title     ?? title.trim(),
        amount:    body.amount    ?? Number(amount),
        amountPaid: body.amountPaid ?? charge.amountPaid,
        date:      body.date      ?? charge.date,
        status:    body.status    ?? charge.status,
        notes:     body.notes     ?? null,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update charge");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">Edit Charge</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X size={18} />
            </button>
          </div>

          <div>
            <label className={lbl}>Description <span className="text-rose-500 normal-case">*</span></label>
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); if (titleErr) setTitleErr(""); }}
              placeholder="e.g. Water bill, Key replacement"
              className={`${field} ${titleErr ? "border-rose-300 focus:ring-rose-400" : ""}`}
            />
            {titleErr && <p className={err}>{titleErr}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Amount <span className="text-rose-500 normal-case">*</span></label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => { setAmount(e.target.value); if (amountErr) setAmountErr(""); }}
                placeholder="500"
                className={`${field} ${amountErr ? "border-rose-300 focus:ring-rose-400" : ""}`}
              />
              {amountErr && <p className={err}>{amountErr}</p>}
            </div>
            <div>
              <label className={lbl}>Date <span className="text-rose-500 normal-case">*</span></label>
              <input
                type="date"
                value={date}
                onChange={e => { setDate(e.target.value); if (dateErr) setDateErr(""); }}
                className={`${field} ${dateErr ? "border-rose-300 focus:ring-rose-400" : ""}`}
              />
              {dateErr && <p className={err}>{dateErr}</p>}
            </div>
          </div>

          <div>
            <label className={lbl}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className={`${field} resize-none`}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Check size={14} />
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function OneTimeChargesPanel({
  tenantId,
  charges: initialCharges,
  currencySymbol,
  isActive,
}: {
  tenantId:       string;
  charges:        SerializedCharge[];
  currencySymbol: string;
  isActive:       boolean;
}) {
  const router  = useRouter();
  const fmt     = (n: number) => formatCurrency(n, currencySymbol);

  const PAGE_SIZE = 8;

  const [charges,       setCharges]       = useState(initialCharges);
  const [page,          setPage]          = useState(1);
  const [editCharge,    setEditCharge]    = useState<SerializedCharge | null>(null);
  const [voidingId,     setVoidingId]     = useState<string | null>(null); // confirm delete
  const [deletingId,    setDeletingId]    = useState<string | null>(null); // loading delete
  const [undoingId,     setUndoingId]     = useState<string | null>(null); // confirm undo paid
  const [undoLoadingId, setUndoLoadingId] = useState<string | null>(null); // loading undo

  // Sync local state whenever the server re-renders (e.g. after router.refresh())
  useEffect(() => { setCharges(initialCharges); setPage(1); }, [initialCharges]);

  const pagedCharges = charges.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleVoid = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/one-time-charges/${id}`, { method: "DELETE" });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to void");
      toast.success("Charge removed");
      setCharges(prev => prev.filter(c => c.id !== id));
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to void charge");
    } finally {
      setDeletingId(null);
      setVoidingId(null);
    }
  };

  const handleUndoPaid = async (id: string) => {
    setUndoLoadingId(id);
    try {
      const res = await fetch(`/api/one-time-charges/${id}/void`, { method: "POST" });
      const body = await res.json() as { error?: string } & Partial<SerializedCharge>;
      if (!res.ok) throw new Error(body.error ?? "Failed to void payment");
      toast.success("Charge payment reversed — now unpaid");
      setCharges(prev => prev.map(c => c.id === id ? { ...c, amountPaid: 0, status: "PENDING" } : c));
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to void payment");
    } finally {
      setUndoLoadingId(null);
      setUndoingId(null);
    }
  };

  const handleSaved = (updated: SerializedCharge) => {
    setCharges(prev => prev.map(c => c.id === updated.id ? updated : c));
    setEditCharge(null);
    router.refresh();
  };

  return (
    <>
      {editCharge && (
        <EditModal
          key={editCharge.id}
          charge={editCharge}
          onClose={() => setEditCharge(null)}
          onSaved={handleSaved}
        />
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">One-time Charges</h2>
            <p className="text-xs text-slate-400 mt-0.5">{charges.length} charge{charges.length !== 1 ? "s" : ""}</p>
          </div>
          {isActive && (
            <a href={`/tenants/${tenantId}/one-time-charge/new`}
              className="text-xs bg-slate-900 dark:bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors font-semibold">
              + Add Charge
            </a>
          )}
        </div>

        {charges.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No one-time charges.</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50/80 to-slate-50/40 dark:from-slate-800/80 dark:to-slate-800/40">
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                    <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {pagedCharges.map(c => {
                    const canEdit    = c.status !== "PAID";
                    const isPaid     = c.status === "PAID" || c.amountPaid > 0;
                    const isVoiding  = voidingId  === c.id;
                    const isDeleting = deletingId === c.id;
                    const isUndoing  = undoingId     === c.id;
                    const isUndoLoading = undoLoadingId === c.id;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors group">
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{c.title}</span>
                          {c.notes && <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs tabular-nums">{formatDate(c.date)}</td>
                        <td className="px-4 py-3.5 text-right text-slate-500">{fmt(c.amount)}</td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white">{fmt(c.amountPaid)}</td>
                        <td className="px-4 py-3.5 text-center"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {c.status !== "PAID" && (
                              <Link href={`/tenants/${tenantId}/one-time-charge/${c.id}/pay`}
                                className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                                Add Payment
                              </Link>
                            )}
                            {canEdit && !isVoiding && (
                              <button onClick={() => setEditCharge(c)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Edit charge">
                                <Pencil size={13} />
                              </button>
                            )}
                            {/* Void payment for paid/partial charges */}
                            {isPaid && (
                              isUndoing ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-slate-500">Undo payment?</span>
                                  <button onClick={() => handleUndoPaid(c.id)} disabled={isUndoLoading}
                                    className="text-xs text-white bg-amber-500 hover:bg-amber-600 px-2 py-1 rounded-lg font-medium disabled:opacity-50 transition-colors">
                                    {isUndoLoading ? "…" : "Yes"}
                                  </button>
                                  <button onClick={() => setUndoingId(null)}
                                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg transition-colors">
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setUndoingId(c.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                  title="Void payment — reset to unpaid">
                                  <RotateCcw size={13} />
                                </button>
                              )
                            )}
                            {canEdit && (
                              isVoiding ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-slate-500">Remove?</span>
                                  <button onClick={() => handleVoid(c.id)} disabled={!!isDeleting}
                                    className="text-xs text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded-lg font-medium disabled:opacity-50 transition-colors">
                                    {isDeleting ? "…" : "Yes"}
                                  </button>
                                  <button onClick={() => setVoidingId(null)}
                                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg transition-colors">
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setVoidingId(c.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Remove charge">
                                  <Trash2 size={13} />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Paginator page={page} total={charges.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-slate-50 dark:divide-slate-800">
              {pagedCharges.map(c => {
                const canEdit       = c.status !== "PAID";
                const isPaid        = c.status === "PAID" || c.amountPaid > 0;
                const isVoiding     = voidingId     === c.id;
                const isDeleting    = deletingId    === c.id;
                const isUndoing     = undoingId     === c.id;
                const isUndoLoading = undoLoadingId === c.id;
                return (
                  <div key={c.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{c.title}</p>
                        {c.notes && <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>}
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(c.date)}</span>
                      <span>
                        Due <span className="font-medium text-slate-700">{fmt(c.amount)}</span>
                        {" · "}Paid <span className="font-bold text-slate-900">{fmt(c.amountPaid)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                      {c.status !== "PAID" && (
                        <Link href={`/tenants/${tenantId}/one-time-charge/${c.id}/pay`}
                          className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                          Add Payment
                        </Link>
                      )}
                      {canEdit && (
                        <button onClick={() => setEditCharge(c)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 px-2 py-1 rounded-lg transition-colors">
                          <Pencil size={11} /> Edit
                        </button>
                      )}
                      {isPaid && (
                        isUndoing ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">Undo payment?</span>
                            <button onClick={() => handleUndoPaid(c.id)} disabled={isUndoLoading}
                              className="text-xs text-white bg-amber-500 hover:bg-amber-600 px-2 py-1 rounded-lg font-medium disabled:opacity-50 transition-colors">
                              {isUndoLoading ? "…" : "Yes"}
                            </button>
                            <button onClick={() => setUndoingId(null)}
                              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg transition-colors">
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setUndoingId(c.id)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-600 border border-slate-200 hover:border-amber-200 px-2 py-1 rounded-lg transition-colors">
                            <RotateCcw size={11} /> Void
                          </button>
                        )
                      )}
                      {canEdit && (
                        isVoiding ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">Remove?</span>
                            <button onClick={() => handleVoid(c.id)} disabled={!!isDeleting}
                              className="text-xs text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded-lg font-medium disabled:opacity-50 transition-colors">
                              {isDeleting ? "…" : "Yes"}
                            </button>
                            <button onClick={() => setVoidingId(null)}
                              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg transition-colors">
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setVoidingId(c.id)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 px-2 py-1 rounded-lg transition-colors">
                            <Trash2 size={11} /> Remove
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
              <Paginator page={page} total={charges.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
