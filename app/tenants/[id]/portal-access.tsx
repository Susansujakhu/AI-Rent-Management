"use client";

import { useState, useEffect } from "react";
import { Globe, Link2, RefreshCw, Trash2, MessageCircle, Copy, Check, Loader2, Lock, Crown } from "lucide-react";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/upgrade-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Props {
  tenantId:      string;
  tenantName:    string;
  tenantPhone:   string;
  portalEnabled: boolean;
  portalToken:   string | null;
  isPro:         boolean;
}

export function PortalAccessCard({ tenantId, tenantName, tenantPhone, portalEnabled, portalToken, isPro }: Props) {
  const [enabled, setEnabled]   = useState(portalEnabled);
  const [token,   setToken]     = useState(portalToken);
  const [upgradeOpen,  setUpgradeOpen]  = useState(false);
  const [regenOpen,    setRegenOpen]    = useState(false);
  const [disableOpen,  setDisableOpen]  = useState(false);
  const [loading, setLoading]   = useState<string | null>(null);
  const [copied,  setCopied]    = useState(false);

  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const portalLink = token ? `${origin}/portal/t/${token}` : null;

  const enable = async () => {
    setLoading("enable");
    try {
      const res  = await fetch(`/api/tenants/${tenantId}/portal`, { method: "POST" });
      const data = await res.json() as { error?: string; upgrade?: boolean; portalToken?: string };
      if (!res.ok) {
        if (data.upgrade) toast.error(`Pro required — ${data.error}`);
        else toast.error(data.error ?? "Failed");
        return;
      }
      setEnabled(true);
      setToken(data.portalToken ?? null);
      toast.success("Portal access enabled");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error enabling portal");
    } finally {
      setLoading(null);
    }
  };

  const regenerate = async () => {
    setRegenOpen(false);
    setLoading("regen");
    try {
      const res  = await fetch(`/api/tenants/${tenantId}/portal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setToken(data.portalToken);
      toast.success("New link generated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error regenerating link");
    } finally {
      setLoading(null);
    }
  };

  const disable = async () => {
    setDisableOpen(false);
    setLoading("disable");
    try {
      const res = await fetch(`/api/tenants/${tenantId}/portal`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setEnabled(false);
      setToken(null);
      toast.success("Portal access revoked");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error disabling portal");
    } finally {
      setLoading(null);
    }
  };

  const copyLink = async () => {
    if (!portalLink) return;
    await navigator.clipboard.writeText(portalLink);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const sendWhatsApp = async () => {
    setLoading("send");
    try {
      const res  = await fetch(`/api/tenants/${tenantId}/portal/send-link`, { method: "POST" });
      const data = await res.json() as { error?: string; upgrade?: boolean };
      if (!res.ok) {
        if (data.upgrade) toast.error(`Pro required — ${data.error}`);
        else toast.error(data.error ?? "Failed to send");
        return;
      }
      toast.success("Portal link sent via WhatsApp");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error sending message");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-500/15 flex items-center justify-center">
            <Globe size={14} className="text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Tenant Portal Access</h2>
            <p className="text-xs text-slate-400">Share a personal link for the tenant to view their account</p>
          </div>
        </div>
        {enabled && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20">
            Active
          </span>
        )}
      </div>

      <ConfirmDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate Portal Link"
        description="This will invalidate the current link. Anyone using the old link will lose access immediately."
        confirmLabel="Regenerate"
        variant="warning"
        onConfirm={regenerate}
      />
      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Revoke Portal Access"
        description={`Disable portal access for ${tenantName}? All active sessions will be revoked immediately.`}
        confirmLabel="Revoke Access"
        variant="destructive"
        onConfirm={disable}
      />

      <div className="px-5 py-4">
        {/* Pro gate */}
        {!isPro ? (
          <>
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center">
                <Lock size={20} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pro feature</p>
                <p className="text-xs text-slate-400 mt-0.5">Tenant portal requires a Pro plan</p>
              </div>
              <button
                onClick={() => setUpgradeOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Crown size={14} />
                Upgrade to Pro
              </button>
            </div>
            <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Tenant portal" />
          </>
        ) : !enabled ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-sm text-slate-500 text-center">
              Portal access is disabled. Enable it to generate a personal link for this tenant.
            </p>
            <button
              onClick={enable}
              disabled={loading === "enable"}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
            >
              {loading === "enable" ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              Enable Portal Access
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Link display */}
            {portalLink && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-2">
                <Link2 size={13} className="text-slate-400 shrink-0" />
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate flex-1 font-mono">{portalLink}</p>
                <button
                  onClick={copyLink}
                  className="shrink-0 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                  title="Copy link"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={sendWhatsApp}
                disabled={loading === "send"}
                className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {loading === "send" ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
                Send via WhatsApp
              </button>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                Copy Link
              </button>
              <button
                onClick={() => setRegenOpen(true)}
                disabled={loading === "regen"}
                className="flex items-center gap-1.5 text-xs font-semibold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                title="Generate a new link (invalidates current)"
              >
                {loading === "regen" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Regenerate
              </button>
              <button
                onClick={() => setDisableOpen(true)}
                disabled={loading === "disable"}
                className="flex items-center gap-1.5 text-xs font-semibold border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {loading === "disable" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Revoke Access
              </button>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">
              The link grants direct access — treat it like a password. Use &quot;Regenerate&quot; to invalidate the old link if it was shared accidentally.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
