"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Bell, CheckCircle2, X, CreditCard, Clock, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";

interface Claim {
  id:             string;
  amount:         number;
  method:         string;
  reference:      string | null;
  paidDate:       string;
  note:           string | null;
  status:         string;
  screenshotPath: string | null;
  createdAt:      string;
  tenant:         { id: string; name: string; room: { name: string } | null };
  payment:        { id: string; month: string } | null;
}

/**
 * Owner-facing queue of tenant-reported payments awaiting review. Tenants
 * report via the portal; this surfaces the pending ones so the owner can
 * verify the money arrived, record it through the normal flow, then confirm
 * (or dismiss) the claim.
 */
export function PaymentClaimsBanner({ currencySymbol }: { currencySymbol: string }) {
  const router = useRouter();
  const [claims, setClaims]   = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  useEffect(() => {
    fetch("/api/payment-claims")
      .then(r => r.ok ? r.json() : [])
      .then((all: Claim[]) => setClaims(all.filter(c => c.status === "pending")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const resolve = async (id: string, action: "confirm" | "reject") => {
    setActing(id);
    try {
      const res = await fetch(`/api/payment-claims/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      });
      if (!res.ok) { toast.error("Failed to update"); return; }
      setClaims(prev => prev.filter(c => c.id !== id));
      toast.success(action === "confirm" ? "Payment confirmed" : "Report dismissed");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setActing(null);
    }
  };

  if (loading || claims.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2.5 bg-indigo-50/70 dark:bg-indigo-500/10 border-b border-indigo-100/70 dark:border-indigo-500/20">
        <Bell size={15} className="text-indigo-500 shrink-0" />
        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 flex-1">
          Tenant-reported payments
          <span className="ml-2 bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{claims.length}</span>
        </p>
        <button onClick={() => setCollapsed(c => !c)} className="text-indigo-500 hover:text-indigo-700 transition-colors">
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {!collapsed && (
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {claims.map(c => {
            const recordHref = c.payment ? `/payments/${c.payment.id}/pay` : `/tenants/${c.tenant.id}`;
            return (
              <div key={c.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{c.tenant.name}</p>
                    <p className="text-xs text-slate-400">
                      {c.tenant.room?.name ?? "—"} · reported {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">{fmt(c.amount)}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/20 px-1.5 py-0.5 rounded-full">
                      <Clock size={9} /> {c.method}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
                  <span>Paid: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(c.paidDate)}</span></span>
                  {c.reference && <span>Ref: <span className="font-mono text-slate-700 dark:text-slate-300">{c.reference}</span></span>}
                  {c.note && <span className="italic">&ldquo;{c.note}&rdquo;</span>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Primary: recording the payment auto-confirms this claim */}
                  <Link
                    href={recordHref}
                    className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
                  >
                    <CreditCard size={12} /> Verify &amp; record
                  </Link>
                  {c.screenshotPath && (
                    <a
                      href={`/api/payment-claims/${c.id}/screenshot`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                    >
                      <ImageIcon size={12} /> Screenshot
                    </a>
                  )}
                  {/* For when the owner already recorded it elsewhere */}
                  <button
                    onClick={() => resolve(c.id, "confirm")}
                    disabled={acting === c.id}
                    className="flex items-center gap-1.5 text-xs border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} /> Mark done
                  </button>
                  <button
                    onClick={() => resolve(c.id, "reject")}
                    disabled={acting === c.id}
                    className="flex items-center gap-1.5 text-xs border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    <X size={12} /> Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-5 py-2.5 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
        <p className="text-[11px] text-slate-400">
          These are tenant reports, not confirmed payments. <span className="font-semibold text-slate-500 dark:text-slate-300">Verify &amp; record</span> takes you to the payment screen and clears the report automatically. Use <span className="font-semibold text-slate-500 dark:text-slate-300">Mark done</span> only if you already recorded it elsewhere.
        </p>
      </div>
    </div>
  );
}
