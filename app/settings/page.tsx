"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Settings, Eye, EyeOff, Coins, ShieldCheck, DatabaseBackup, Download, UserCog, MessageCircle, Wifi, WifiOff, RefreshCw, Smartphone } from "lucide-react";

const PRESETS = [
  { label: "Nepali Rupee", code: "NPR", symbol: "रू", flag: "🇳🇵" },
  { label: "Indian Rupee",  code: "INR", symbol: "₹",  flag: "🇮🇳" },
  { label: "US Dollar",    code: "USD", symbol: "$",   flag: "🇺🇸" },
  { label: "Euro",         code: "EUR", symbol: "€",   flag: "🇪🇺" },
  { label: "British Pound",code: "GBP", symbol: "£",   flag: "🇬🇧" },
  { label: "Custom",       code: "CUSTOM", symbol: "",  flag: "✏️" },
];

type WAStatus = "disconnected" | "connecting" | "qr" | "ready";

export default function SettingsPage() {
  const [selectedCode, setSelectedCode] = useState("NPR");
  const [customSymbol, setCustomSymbol] = useState("");
  const [customCode,   setCustomCode]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [loaded,       setLoaded]       = useState(false);

  // Account info
  const [userEmail,    setUserEmail]    = useState("");

  // WhatsApp state
  const [waStatus,   setWaStatus]   = useState<WAStatus>("disconnected");
  const [waQR,       setWaQR]       = useState<string | null>(null);
  const [waPhone,    setWaPhone]    = useState<string | null>(null);
  const [waPolling,  setWaPolling]  = useState(false);
  const [waTplPayment,  setWaTplPayment]  = useState("");
  const [waTplDue,      setWaTplDue]      = useState("");
  const [waTplOverdue,  setWaTplOverdue]  = useState("");
  const [savingTpl,     setSavingTpl]     = useState(false);

  // Change password/email form
  const [currentPassword,  setCurrentPassword]  = useState("");
  const [newPassword,      setNewPassword]      = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");
  const [newEmail,         setNewEmail]         = useState("");
  const [showPass,         setShowPass]         = useState(false);
  const [savingAccount,    setSavingAccount]    = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()),
      fetch("/api/auth/me").then(r => r.ok ? r.json() : null),
    ]).then(([settings, me]: [Record<string, string>, { email: string } | null]) => {
      const code   = settings["currency_code"]   ?? "NPR";
      const symbol = settings["currency_symbol"] ?? "रू";
      const preset = PRESETS.find(p => p.code === code && p.code !== "CUSTOM");
      if (preset) {
        setSelectedCode(code);
      } else {
        setSelectedCode("CUSTOM");
        setCustomSymbol(symbol);
        setCustomCode(code);
      }
      if (me) setUserEmail(me.email);
      setLoaded(true);
    });

    // Initial WhatsApp status + templates
    fetch("/api/whatsapp/status")
      .then(r => r.ok ? r.json() : null)
      .then((d: { status: WAStatus; qrImage: string | null; phone: string | null } | null) => {
        if (d) { setWaStatus(d.status); setWaQR(d.qrImage); setWaPhone(d.phone); }
      });
    fetch("/api/settings")
      .then(r => r.json())
      .then((d: Record<string, string>) => {
        if (d["wa_tpl_payment_received"]) setWaTplPayment(d["wa_tpl_payment_received"]);
        if (d["wa_tpl_rent_due"])         setWaTplDue(d["wa_tpl_rent_due"]);
        if (d["wa_tpl_rent_overdue"])     setWaTplOverdue(d["wa_tpl_rent_overdue"]);
      });
  }, []);

  // Poll WhatsApp status while connecting or waiting for QR scan
  useEffect(() => {
    if (waStatus !== "connecting" && waStatus !== "qr") { setWaPolling(false); return; }
    setWaPolling(true);
    const interval = setInterval(async () => {
      const res = await fetch("/api/whatsapp/status");
      if (!res.ok) return;
      const d = await res.json() as { status: WAStatus; qrImage: string | null; phone: string | null };
      setWaStatus(d.status); setWaQR(d.qrImage); setWaPhone(d.phone);
      if (d.status === "ready" || d.status === "disconnected") {
        clearInterval(interval);
        setWaPolling(false);
        if (d.status === "ready") toast.success("WhatsApp connected! 🎉");
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [waStatus]);

  const handleConnectWA = async () => {
    setWaStatus("connecting");
    await fetch("/api/whatsapp/connect", { method: "POST" });
  };

  const handleSaveTemplates = async () => {
    setSavingTpl(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wa_tpl_payment_received: waTplPayment || undefined,
          wa_tpl_rent_due:         waTplDue     || undefined,
          wa_tpl_rent_overdue:     waTplOverdue || undefined,
        }),
      });
      toast.success("Message templates saved");
    } catch {
      toast.error("Failed to save templates");
    } finally {
      setSavingTpl(false);
    }
  };

  const handleDisconnectWA = async () => {
    await fetch("/api/whatsapp/connect", { method: "DELETE" });
    setWaStatus("disconnected"); setWaQR(null); setWaPhone(null);
    toast.success("WhatsApp disconnected");
  };

  const currentSymbol = selectedCode === "CUSTOM"
    ? customSymbol
    : PRESETS.find(p => p.code === selectedCode)?.symbol ?? "रू";
  const currentCode = selectedCode === "CUSTOM" ? customCode : selectedCode;

  const handleSaveCurrency = async () => {
    if (!currentSymbol) { toast.error("Currency symbol is required"); return; }
    if (!currentCode)   { toast.error("Currency code is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency_symbol: currentSymbol, currency_code: currentCode }),
      });
      if (!res.ok) throw new Error();
      toast.success("Currency saved — reload to apply everywhere");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!currentPassword) { toast.error("Enter your current password"); return; }
    if (!newPassword && !newEmail) { toast.error("Enter a new password or email to update"); return; }
    if (newPassword && newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword && newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setSavingAccount(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: newPassword || undefined, newEmail: newEmail || undefined }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to update account"); return; }
      toast.success("Account updated successfully");
      if (newEmail) setUserEmail(newEmail);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setNewEmail("");
    } catch {
      toast.error("Failed to update account");
    } finally {
      setSavingAccount(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fieldCls = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50/50 transition-all";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Settings size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500">Configure app preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left column */}
      <div className="space-y-6">

      {/* Currency */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 border-l-4 border-l-indigo-500">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Coins size={15} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Currency</h2>
            <p className="text-xs text-slate-400 mt-0.5">Applied across all pages and reports</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-2.5">
            {PRESETS.map(preset => {
              const isSelected = selectedCode === preset.code;
              return (
                <button
                  key={preset.code}
                  onClick={() => setSelectedCode(preset.code)}
                  className={`relative flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50/60 shadow-sm shadow-indigo-100"
                      : "border-slate-150 border hover:border-slate-300 hover:bg-slate-50/80"
                  }`}
                >
                  <span className="text-2xl leading-none">{preset.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>{preset.label}</p>
                    <p className={`text-xs mt-0.5 ${isSelected ? "text-indigo-400" : "text-slate-400"}`}>
                      {preset.code}{preset.symbol ? ` · ${preset.symbol}` : ""}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-300">
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedCode === "CUSTOM" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Symbol</label>
                <input type="text" value={customSymbol} onChange={e => setCustomSymbol(e.target.value)} placeholder="e.g. Fr." maxLength={5} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Code</label>
                <input type="text" value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} placeholder="e.g. CHF" maxLength={5} className={fieldCls} />
              </div>
            </div>
          )}

          {currentSymbol && (
            <div className="bg-slate-50 rounded-xl px-4 py-3.5 flex items-center justify-between border border-slate-100">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preview</span>
              <span className="text-lg font-black text-slate-900">{currentSymbol}10,000</span>
            </div>
          )}

          <button onClick={handleSaveCurrency} disabled={saving}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-200/60">
            {saving ? "Saving…" : "Save Currency Settings"}
          </button>
        </div>
      </div>

      {/* Account */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 border-l-4 border-l-emerald-500">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <ShieldCheck size={15} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Account</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{userEmail}</p>
          </div>
          <div className="ml-auto">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
              <UserCog size={14} className="text-slate-400" />
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-400">Change your email or password. Current password is required to confirm any changes.</p>

          <div>
            <label className={labelCls}>Current Password <span className="text-rose-500 normal-case font-normal">*</span></label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password" autoComplete="current-password" className={`${fieldCls} pr-10`} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>New Email <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder={userEmail} autoComplete="email" className={fieldCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>New Password <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
              <input type={showPass ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters" autoComplete="new-password" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Confirm</label>
              <input type={showPass ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password" autoComplete="new-password"
                className={`${fieldCls} ${confirmPassword && confirmPassword !== newPassword ? "border-rose-300 focus:ring-rose-400" : ""}`} />
            </div>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-rose-500 text-xs -mt-2">Passwords do not match</p>
          )}

          <button onClick={handleSaveAccount} disabled={savingAccount || !currentPassword || (!newPassword && !newEmail)}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-200">
            {savingAccount ? "Saving…" : "Update Account"}
          </button>
        </div>
      </div>

      </div>{/* end left column */}

      {/* Right column */}
      <div className="space-y-6">

      {/* WhatsApp */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 border-l-4 border-l-green-500">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
            <MessageCircle size={15} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">WhatsApp Notifications</h2>
            <p className="text-xs text-slate-400 mt-0.5">Auto-notify tenants on payments &amp; reminders</p>
          </div>
          <div className="ml-auto">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
              waStatus === "ready"
                ? "bg-green-50 text-green-700 border-green-200"
                : waStatus === "qr" || waStatus === "connecting"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}>
              {waStatus === "ready" ? <Wifi size={10} /> : <WifiOff size={10} />}
              {waStatus === "ready" ? "Connected" : waStatus === "qr" ? "Scan QR" : waStatus === "connecting" ? "Connecting…" : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {waStatus === "ready" && (
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                  <Smartphone size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-900">WhatsApp Active</p>
                  <p className="text-xs text-green-600 font-medium">+{waPhone}</p>
                </div>
              </div>
              <button onClick={handleDisconnectWA}
                className="text-xs text-rose-500 hover:text-rose-600 font-semibold border border-rose-200 hover:border-rose-300 px-3 py-1.5 rounded-lg transition-colors">
                Disconnect
              </button>
            </div>
          )}

          {(waStatus === "qr") && waQR && (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-sm font-semibold text-slate-700">Scan with your WhatsApp</p>
              <p className="text-xs text-slate-400 text-center max-w-xs">Open WhatsApp → tap ⋮ → Linked devices → Link a device → scan this code</p>
              <div className="p-3 bg-white border-2 border-green-200 rounded-2xl shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={waQR} alt="WhatsApp QR Code" className="w-56 h-56" />
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
                <RefreshCw size={12} className="animate-spin" />
                Waiting for scan…
              </div>
            </div>
          )}

          {waStatus === "connecting" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Starting WhatsApp… this may take 15–30 seconds</p>
            </div>
          )}

          {waStatus === "disconnected" && (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-xs text-slate-500">
                <p className="font-semibold text-slate-700 text-sm">What gets sent automatically:</p>
                <p>✅ Payment confirmation when rent is recorded</p>
                <p>⚠️ Manual overdue reminders from payments page</p>
                <p className="text-slate-400">Toggle notifications per tenant on their profile page</p>
              </div>
              <button onClick={handleConnectWA}
                className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-green-700 transition-all shadow-md shadow-green-200/60 flex items-center justify-center gap-2">
                <MessageCircle size={16} />
                Connect WhatsApp
              </button>
              <p className="text-xs text-slate-400 text-center">Uses your personal WhatsApp via QR code. Free, no account needed.</p>
            </div>
          )}

          {/* Message templates — always visible */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <div>
              <p className="text-sm font-bold text-slate-700 mb-1">Message Templates</p>
              <p className="text-xs text-slate-400">Customize the messages sent to tenants. Use <code className="bg-slate-100 px-1 rounded text-slate-600">{"{name}"}</code> <code className="bg-slate-100 px-1 rounded text-slate-600">{"{amount}"}</code> <code className="bg-slate-100 px-1 rounded text-slate-600">{"{month}"}</code> <code className="bg-slate-100 px-1 rounded text-slate-600">{"{room}"}</code> as placeholders.</p>
            </div>

            {[
              { key: "payment",  label: "✅ Payment Received",  val: waTplPayment,  set: setWaTplPayment,  def: "Hi {name}! ✅\n\nYour payment of *{amount}* for *{room}* ({month}) has been received.\n\nThank you! 🙏" },
              { key: "due",      label: "📋 Rent Due",          val: waTplDue,      set: setWaTplDue,      def: "Hi {name}! 📋\n\nYour rent of *{amount}* for *{room}* is due for *{month}*.\n\nPlease pay on time. Thank you!" },
              { key: "overdue",  label: "⚠️ Rent Overdue",     val: waTplOverdue,  set: setWaTplOverdue,  def: "Hi {name}! ⚠️\n\nYour rent of *{amount}* for *{room}* ({month}) is *overdue*.\n\nPlease contact us to settle your dues. Thank you." },
            ].map(({ key, label, val, set, def }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
                <textarea
                  value={val}
                  onChange={e => set(e.target.value)}
                  rows={5}
                  placeholder={def}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent bg-slate-50/50 transition-all resize-none font-mono text-xs"
                />
                {val && (
                  <button onClick={() => set("")} className="text-xs text-slate-400 hover:text-slate-600 mt-1">
                    Reset to default
                  </button>
                )}
              </div>
            ))}

            <button onClick={handleSaveTemplates} disabled={savingTpl}
              className="w-full border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
              {savingTpl ? "Saving…" : "Save Templates"}
            </button>
          </div>
        </div>
      </div>

      {/* Data Backup */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 border-l-4 border-l-violet-500">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <DatabaseBackup size={15} className="text-violet-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Data Backup</h2>
            <p className="text-xs text-slate-400 mt-0.5">Download all your data as a JSON file</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Includes rooms, tenants, payments, expenses, and charges. Credentials are not exported.
          </p>
          <a href="/api/backup?confirm=1" download
            className="inline-flex items-center gap-2.5 bg-gradient-to-r from-slate-800 to-slate-700 text-white px-5 py-3 rounded-xl text-sm font-bold hover:from-slate-700 hover:to-slate-600 transition-all shadow-md shadow-slate-300/60">
            <Download size={15} />
            Download Backup
          </a>
        </div>
      </div>

      </div>{/* end right column */}
      </div>{/* end grid */}
    </div>
  );
}
