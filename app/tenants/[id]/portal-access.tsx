"use client";

import { useState } from "react";
import { Globe, Link2, RefreshCw, Trash2, MessageCircle, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantId:      string;
  tenantName:    string;
  tenantPhone:   string;
  portalEnabled: boolean;
  portalToken:   string | null;
}

export function PortalAccessCard({ tenantId, tenantName, tenantPhone, portalEnabled, portalToken }: Props) {
  const [enabled, setEnabled]   = useState(portalEnabled);
  const [token,   setToken]     = useState(portalToken);
  const [loading, setLoading]   = useState<string | null>(null);
  const [copied,  setCopied]    = useState(false);

  const origin     = process.env.NEXT_PUBLIC_APP_URL
    ?? (typeof window !== "undefined" ? window.location.origin : "");
  const portalLink = token ? `${origin}/portal/t/${token}` : null;

  const enable = async () => {
    setLoading("enable");
    try {
      const res  = await fetch(`/api/tenants/${tenantId}/portal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEnabled(true);
      setToken(data.portalToken);
      toast.success("Portal access enabled");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error enabling portal");
    } finally {
      setLoading(null);
    }
  };

  const regenerate = async () => {
    if (!confirm("This will invalidate the current link. Continue?")) return;
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
    if (!confirm(`Disable portal access for ${tenantName}? All active sessions will be revoked.`)) return;
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

  const sendWhatsApp = () => {
    if (!portalLink) return;
    const phone = tenantPhone.replace(/\D/g, "");
    const msg   = encodeURIComponent(
      `Hi ${tenantName}, here's your tenant portal link to view your rent and payments:\n\n${portalLink}\n\nBookmark this page for future access.`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
            <Globe size={14} className="text-teal-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Tenant Portal Access</h2>
            <p className="text-xs text-slate-400">Share a personal link for the tenant to view their account</p>
          </div>
        </div>
        {enabled && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
            Active
          </span>
        )}
      </div>

      <div className="px-5 py-4">
        {!enabled ? (
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
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-2">
                <Link2 size={13} className="text-slate-400 shrink-0" />
                <p className="text-xs text-slate-600 truncate flex-1 font-mono">{portalLink}</p>
                <button
                  onClick={copyLink}
                  className="shrink-0 p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
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
                className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <MessageCircle size={12} />
                Send via WhatsApp
              </button>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                Copy Link
              </button>
              <button
                onClick={regenerate}
                disabled={loading === "regen"}
                className="flex items-center gap-1.5 text-xs font-semibold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                title="Generate a new link (invalidates current)"
              >
                {loading === "regen" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Regenerate
              </button>
              <button
                onClick={disable}
                disabled={loading === "disable"}
                className="flex items-center gap-1.5 text-xs font-semibold border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {loading === "disable" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Revoke Access
              </button>
            </div>

            <p className="text-xs text-slate-400">
              The link grants direct access — treat it like a password. Use &quot;Regenerate&quot; to invalidate the old link if it was shared accidentally.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
