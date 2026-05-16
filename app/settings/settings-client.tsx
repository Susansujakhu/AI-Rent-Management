"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Settings, Eye, EyeOff, Coins, ShieldCheck, DatabaseBackup, Download, Upload, UserCog, MessageCircle, Wifi, WifiOff, RefreshCw, Smartphone, Bell, Clock, AlertTriangle, Crown, Lock, QrCode } from "lucide-react";
import { UpgradeModal } from "@/components/upgrade-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function WhatsAppProGate() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center">
        <Lock size={28} className="text-amber-500" />
      </div>
      <div>
        <p className="text-base font-bold text-slate-800 dark:text-slate-200">WhatsApp requires Pro</p>
        <p className="text-sm text-slate-400 mt-1 max-w-xs">
          Connect your WhatsApp to send rent reminders, payment receipts and overdue notices directly to tenants.
        </p>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
      >
        <Crown size={16} />
        Upgrade to Pro
      </button>
      <UpgradeModal open={open} onClose={() => setOpen(false)} feature="WhatsApp notifications" />
    </div>
  );
}

const PRESETS = [
  { label: "Nepali Rupee", code: "NPR", symbol: "रू", flag: "🇳🇵" },
  { label: "Indian Rupee",  code: "INR", symbol: "₹",  flag: "🇮🇳" },
  { label: "US Dollar",    code: "USD", symbol: "$",   flag: "🇺🇸" },
  { label: "Euro",         code: "EUR", symbol: "€",   flag: "🇪🇺" },
  { label: "British Pound",code: "GBP", symbol: "£",   flag: "🇬🇧" },
  { label: "Custom",       code: "CUSTOM", symbol: "",  flag: "✏️" },
];


const TABS = [
  { id: "currency",  label: "Currency",  icon: Coins,          accent: "indigo" },
  { id: "account",   label: "Account",   icon: ShieldCheck,    accent: "emerald" },
  { id: "payments",  label: "Payments",  icon: QrCode,         accent: "teal" },
  { id: "whatsapp",  label: "WhatsApp",  icon: MessageCircle,  accent: "green" },
  { id: "reminders", label: "Reminders", icon: Bell,           accent: "amber" },
  { id: "backup",    label: "Backup",    icon: DatabaseBackup, accent: "violet" },
] as const;
type TabId = typeof TABS[number]["id"];

export default function SettingsClient({ isPro }: { isPro: boolean }) {
  const [activeTab,     setActiveTab]     = useState<TabId>("currency");
  const [selectedCode, setSelectedCode] = useState("NPR");
  const [customSymbol, setCustomSymbol] = useState("");
  const [customCode,   setCustomCode]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [loaded,       setLoaded]       = useState(false);

  // Account info
  const [userEmail,    setUserEmail]    = useState("");

  // WhatsApp state
  const [waConfigured, setWaConfigured] = useState(false);
  const [waTplPayment,  setWaTplPayment]  = useState("");
  const [waTplDue,      setWaTplDue]      = useState("");
  const [waTplOverdue,  setWaTplOverdue]  = useState("");
  const [savingTpl,     setSavingTpl]     = useState(false);

  // Online payments
  const [esewaId,        setEsewaId]        = useState("");
  const [khaltiId,       setKhaltiId]       = useState("");
  const [fonepayId,      setFonepayId]      = useState("");
  const [paymentNote,    setPaymentNote]    = useState("");
  const [savingPayments, setSavingPayments] = useState(false);
  const [qrExists,       setQrExists]       = useState<Record<string, boolean>>({});
  const [qrStamp,        setQrStamp]        = useState<Record<string, number>>({});
  const [qrUploading,    setQrUploading]    = useState<Record<string, boolean>>({});

  // Auto reminders
  const [autoReminders,    setAutoReminders]    = useState(false);
  const [reminderHour,     setReminderHour]     = useState(9);
  const [reminderLastRun,  setReminderLastRun]  = useState<string | null>(null);
  const [savingReminders,  setSavingReminders]  = useState(false);

  // Change password/email form
  const [currentPassword,  setCurrentPassword]  = useState("");
  const [newPassword,      setNewPassword]      = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");
  const [newEmail,         setNewEmail]         = useState("");
  const [showPass,         setShowPass]         = useState(false);
  const [savingAccount,    setSavingAccount]    = useState(false);
  const [currentPassErr,   setCurrentPassErr]   = useState("");
  const [newEmailErr,      setNewEmailErr]      = useState("");
  const [newPasswordErr,   setNewPasswordErr]   = useState("");

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
      if (me) { setUserEmail(me.email); setNewEmail(me.email); }
      if (settings["esewaId"])     setEsewaId(settings["esewaId"]);
      if (settings["khaltiId"])    setKhaltiId(settings["khaltiId"]);
      if (settings["fonepayId"])   setFonepayId(settings["fonepayId"]);
      if (settings["paymentNote"]) setPaymentNote(settings["paymentNote"]);
      // check which QR images exist
      for (const t of ["esewa", "khalti", "fonepay"]) {
        fetch(`/api/settings/payment-qr?type=${t}`)
          .then(r => setQrExists(prev => ({ ...prev, [t]: r.ok })))
          .catch(() => {});
      }
      if (settings["auto_reminders_enabled"] === "true") setAutoReminders(true);
      if (settings["reminder_hour"]) setReminderHour(parseInt(settings["reminder_hour"]));
      if (settings["reminder_last_run"]) setReminderLastRun(settings["reminder_last_run"]);
      setLoaded(true);
    });

    // Initial WhatsApp status + templates
    fetch("/api/whatsapp/status")
      .then(r => r.ok ? r.json() : null)
      .then((d: { configured: boolean } | null) => {
        if (d) setWaConfigured(d.configured);
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

  const handleSavePayments = async () => {
    setSavingPayments(true);
    try {
      const res = await fetch("/api/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ esewaId, khaltiId, fonepayId, paymentNote }),
      });
      if (!res.ok) throw new Error();
      toast.success("Payment settings saved");
    } catch {
      toast.error("Failed to save payment settings");
    } finally {
      setSavingPayments(false);
    }
  };

  const handleQRUpload = async (type: string, file: File) => {
    setQrUploading(prev => ({ ...prev, [type]: true }));
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/settings/payment-qr?type=${type}`, { method: "POST", body: form });
      if (!res.ok) { const d = await res.json() as { error?: string }; toast.error(d.error ?? "Upload failed"); return; }
      setQrExists(prev => ({ ...prev, [type]: true }));
      setQrStamp(prev => ({ ...prev, [type]: Date.now() }));
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} QR uploaded`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setQrUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleQRDelete = async (type: string) => {
    await fetch(`/api/settings/payment-qr?type=${type}`, { method: "DELETE" });
    setQrExists(prev => ({ ...prev, [type]: false }));
    toast.success("QR removed");
  };

  const handleSaveReminders = async () => {
    setSavingReminders(true);
    try {
      const res = await fetch("/api/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          auto_reminders_enabled: autoReminders ? "true" : "false",
          reminder_hour:          String(reminderHour),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(autoReminders ? "Auto reminders enabled" : "Auto reminders disabled");
    } catch {
      toast.error("Failed to save reminder settings");
    } finally {
      setSavingReminders(false);
    }
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
    setCurrentPassErr("");
    setNewEmailErr("");
    setNewPasswordErr("");
    let valid = true;
    if (!currentPassword) { setCurrentPassErr("Current password is required"); valid = false; }
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setNewEmailErr("Enter a valid email address"); valid = false; }
    if (newPassword && newPassword.length < 6) { setNewPasswordErr("Password must be at least 6 characters"); valid = false; }
    if (newPassword && newPassword !== confirmPassword) { setNewPasswordErr("Passwords do not match"); valid = false; }
    if (!valid) return;
    setSavingAccount(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: newPassword || undefined, newEmail }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to update account"); return; }
      toast.success("Account updated successfully");
      setUserEmail(newEmail);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
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

  const fieldCls = "w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50/50 dark:bg-slate-800/50 transition-all";
  const labelCls = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Settings size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500">Configure app preferences</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-1.5 flex gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all flex-1 ${
              activeTab === id
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Icon size={14} strokeWidth={activeTab === id ? 2.5 : 2} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

        {/* ── Currency ─────────────────────────────────────────── */}
        {activeTab === "currency" && (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {/* Header row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 md:px-8 py-6 md:py-7">
              <div className="pt-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center"><Coins size={12} className="text-indigo-600" /></div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Display Currency</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Choose the currency symbol shown on rent amounts, invoices, and reports throughout the app.</p>
              </div>
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESETS.map(preset => {
                    const isSelected = selectedCode === preset.code;
                    return (
                      <button key={preset.code} onClick={() => setSelectedCode(preset.code)}
                        className={`relative flex items-center gap-2.5 p-3.5 rounded-xl border-2 text-left transition-all ${isSelected ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/15 shadow-sm shadow-indigo-100" : "border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/80 dark:hover:bg-slate-800"}`}>
                        <span className="text-xl leading-none">{preset.flag}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${isSelected ? "text-indigo-700 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"}`}>{preset.label}</p>
                          <p className={`text-[11px] mt-0.5 ${isSelected ? "text-indigo-400" : "text-slate-400"}`}>{preset.code}{preset.symbol ? ` · ${preset.symbol}` : ""}</p>
                        </div>
                        {isSelected && <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center"><Check size={8} className="text-white" strokeWidth={3} /></div>}
                      </button>
                    );
                  })}
                </div>
                {selectedCode === "CUSTOM" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={labelCls}>Symbol</label><input type="text" value={customSymbol} onChange={e => setCustomSymbol(e.target.value)} placeholder="e.g. Fr." maxLength={5} className={fieldCls} /></div>
                    <div><label className={labelCls}>Code</label><input type="text" value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} placeholder="e.g. CHF" maxLength={5} className={fieldCls} /></div>
                  </div>
                )}
                {currentSymbol && (
                  <div className="flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl px-4 py-3">
                    <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Preview</span>
                    <span className="text-xl font-black text-indigo-900 dark:text-indigo-300">{currentSymbol}10,000</span>
                  </div>
                )}
              </div>
            </div>
            {/* Save row */}
            <div className="px-5 md:px-8 py-4 flex justify-end bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={handleSaveCurrency} disabled={saving}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-200">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* ── Account ──────────────────────────────────────────── */}
        {activeTab === "account" && (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {/* Current password */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 md:px-8 py-6 md:py-7">
              <div className="pt-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center"><ShieldCheck size={12} className="text-emerald-600" /></div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Authentication</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Signed in as <span className="font-semibold text-slate-600">{userEmail}</span>. Current password required to make any changes.</p>
              </div>
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className={labelCls}>Current Password <span className="text-rose-400 normal-case font-normal">required</span></label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={currentPassword}
                      onChange={e => { setCurrentPassword(e.target.value); if (currentPassErr) setCurrentPassErr(""); }}
                      placeholder="Enter your current password" autoComplete="current-password"
                      className={`${fieldCls} pr-10 ${currentPassErr ? "border-rose-300 focus:ring-rose-400" : ""}`} />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {currentPassErr && <p className="text-rose-500 text-xs mt-1.5">{currentPassErr}</p>}
                </div>
                <div>
                  <label className={labelCls}>Email <span className="text-rose-400 normal-case font-normal">*</span></label>
                  <input type="email" value={newEmail}
                    onChange={e => { setNewEmail(e.target.value); if (newEmailErr) setNewEmailErr(""); }}
                    placeholder="you@example.com" autoComplete="email"
                    className={`${fieldCls} ${newEmailErr ? "border-rose-300 focus:ring-rose-400" : ""}`} />
                  {newEmailErr && <p className="text-rose-500 text-xs mt-1.5">{newEmailErr}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>New Password <span className="text-slate-300 normal-case font-normal">optional</span></label>
                    <input type={showPass ? "text" : "password"} value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); if (newPasswordErr) setNewPasswordErr(""); }}
                      placeholder="Min. 6 characters" autoComplete="new-password"
                      className={`${fieldCls} ${newPasswordErr ? "border-rose-300 focus:ring-rose-400" : ""}`} />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm Password</label>
                    <input type={showPass ? "text" : "password"} value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); if (newPasswordErr) setNewPasswordErr(""); }}
                      placeholder="Repeat new password" autoComplete="new-password"
                      className={`${fieldCls} ${confirmPassword && confirmPassword !== newPassword ? "border-rose-300 focus:ring-rose-400" : ""}`} />
                  </div>
                </div>
                {newPasswordErr && <p className="text-rose-500 text-xs -mt-1">{newPasswordErr}</p>}
                {!newPasswordErr && confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-rose-500 text-xs -mt-1">Passwords do not match</p>
                )}
              </div>
            </div>
            {/* Save row */}
            <div className="px-5 md:px-8 py-4 flex justify-end bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={handleSaveAccount} disabled={savingAccount}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm shadow-emerald-200">
                {savingAccount ? "Saving…" : "Update Account"}
              </button>
            </div>
          </div>
        )}

        {/* ── Online Payments ──────────────────────────────────── */}
        {activeTab === "payments" && (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {/* QR image upload cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 md:px-8 py-6 md:py-7">
              <div className="pt-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-teal-100 flex items-center justify-center"><QrCode size={12} className="text-teal-600" /></div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Payment QR Codes</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload your official QR codes downloaded from eSewa, Khalti, or FonePay merchant portals. Tenants will scan these on their portal to pay you directly.
                </p>
              </div>
              <div className="md:col-span-2">
                <div className="grid grid-cols-3 gap-3">
                  {(["esewa", "khalti", "fonepay"] as const).map(type => {
                    const labels: Record<string, string> = { esewa: "eSewa", khalti: "Khalti", fonepay: "FonePay" };
                    const borders: Record<string, string> = { esewa: "border-emerald-200", khalti: "border-violet-200",  fonepay: "border-blue-200" };
                    const bgs:     Record<string, string> = { esewa: "bg-emerald-50/40",   khalti: "bg-violet-50/40",   fonepay: "bg-blue-50/40" };
                    const texts:   Record<string, string> = { esewa: "text-emerald-700",   khalti: "text-violet-700",   fonepay: "text-blue-700" };
                    const has  = !!qrExists[type];
                    const stamp = qrStamp[type] ?? 0;
                    const busy = !!qrUploading[type];
                    return (
                      <div key={type} className="flex flex-col items-center gap-2">
                        <div className={`w-full aspect-square rounded-xl border-2 flex items-center justify-center overflow-hidden ${has ? `${borders[type]} ${bgs[type]}` : "border-dashed border-slate-200 bg-slate-50"}`}>
                          {has ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/settings/payment-qr?type=${type}&t=${stamp}`}
                              alt={`${labels[type]} QR`}
                              className="w-full h-full object-contain p-2"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-slate-300">
                              <QrCode size={24} />
                              <span className="text-[10px] font-medium">No QR</span>
                            </div>
                          )}
                        </div>
                        <p className={`text-xs font-bold ${texts[type]}`}>{labels[type]}</p>
                        <div className="flex gap-1.5 w-full">
                          <label className={`flex-1 cursor-pointer text-center text-xs font-semibold py-1.5 rounded-lg transition-colors ${busy ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}>
                            {busy ? "…" : has ? "Replace" : "Upload"}
                            <input type="file" accept="image/*" className="hidden" disabled={busy}
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleQRUpload(type, f); e.currentTarget.value = ""; }} />
                          </label>
                          {has && (
                            <button onClick={() => handleQRDelete(type)}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 transition-colors">
                              Del
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Merchant IDs + payment note */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 md:px-8 py-6 md:py-7">
              <div className="pt-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-teal-100 flex items-center justify-center"><QrCode size={12} className="text-teal-600" /></div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Merchant IDs</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Optionally enter your phone or merchant ID for each service. Shown to tenants below the QR code.
                </p>
              </div>
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className={labelCls}>eSewa ID <span className="text-slate-300 normal-case font-normal">phone or merchant code</span></label>
                  <input type="text" value={esewaId} onChange={e => setEsewaId(e.target.value)}
                    placeholder="e.g. 9800000000" className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Khalti ID <span className="text-slate-300 normal-case font-normal">phone or merchant ID</span></label>
                  <input type="text" value={khaltiId} onChange={e => setKhaltiId(e.target.value)}
                    placeholder="e.g. 9800000001" className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>FonePay ID <span className="text-slate-300 normal-case font-normal">merchant code</span></label>
                  <input type="text" value={fonepayId} onChange={e => setFonepayId(e.target.value)}
                    placeholder="e.g. MERCHANT123" className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Payment Instructions <span className="text-slate-300 normal-case font-normal">shown to tenants</span></label>
                  <textarea rows={3} value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
                    placeholder="e.g. After payment please send screenshot via WhatsApp to 9800000000"
                    className={`${fieldCls} resize-none`} />
                </div>
              </div>
            </div>

            <div className="px-5 md:px-8 py-4 flex justify-end bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={handleSavePayments} disabled={savingPayments}
                className="bg-teal-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-teal-700 disabled:opacity-50 transition-all shadow-sm shadow-teal-200">
                {savingPayments ? "Saving…" : "Save IDs & Note"}
              </button>
            </div>
          </div>
        )}

        {/* ── WhatsApp ─────────────────────────────────────────── */}
        {activeTab === "whatsapp" && !isPro && (
          <WhatsAppProGate />
        )}
        {activeTab === "whatsapp" && isPro && (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {/* Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 md:px-8 py-6 md:py-7">
              <div className="pt-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center"><MessageCircle size={12} className="text-green-600" /></div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">WhatsApp Notifications</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Messages are sent from the platform&apos;s WhatsApp Business number — no personal connection needed.</p>
                <div className="mt-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${waConfigured ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                    {waConfigured ? <Wifi size={10} /> : <WifiOff size={10} />}
                    {waConfigured ? "Active" : "Not configured"}
                  </span>
                </div>
              </div>
              <div className="md:col-span-2">
                <div className={`rounded-xl p-4 space-y-1.5 text-xs border ${waConfigured ? "bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20 text-slate-500" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400"}`}>
                  <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm mb-2">What gets sent automatically</p>
                  <p>✅ Payment confirmation when rent is recorded</p>
                  <p>✅ Daily overdue reminders (if enabled in Reminders tab)</p>
                  <p>⚠️ Manual reminders from each tenant&apos;s payment ledger</p>
                </div>
              </div>
            </div>

            {/* Message templates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 md:px-8 py-6 md:py-7">
              <div className="pt-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center"><MessageCircle size={12} className="text-green-600" /></div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Message Templates</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">Customize the text sent to tenants. Leave blank to use defaults.</p>
                <div className="space-y-1">
                  {["{name}", "{amount}", "{month}", "{room}", "{receipt}"].map(p => (
                    <code key={p} className="block text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{p}</code>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 space-y-4">
                {[
                  { key: "payment", label: "✅ Payment Received", val: waTplPayment, set: setWaTplPayment, def: "Hi {name}! ✅\n\nYour payment of *{amount}* for *{room}* ({month}) has been received.\n\nThank you! 🙏\n\n📄 Receipt: {receipt}" },
                  { key: "due",     label: "📋 Rent Due",         val: waTplDue,     set: setWaTplDue,     def: "Hi {name}! 📋\n\nYour rent of *{amount}* for *{room}* is due for *{month}*.\n\nPlease pay on time. Thank you!" },
                  { key: "overdue", label: "⚠️ Rent Overdue",    val: waTplOverdue, set: setWaTplOverdue, def: "Hi {name}! ⚠️\n\nYour rent of *{amount}* for *{room}* ({month}) is *overdue*.\n\nPlease contact us to settle your dues. Thank you." },
                ].map(({ key, label, val, set, def }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
                      {val && <button onClick={() => set("")} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Reset</button>}
                    </div>
                    <textarea value={val} onChange={e => set(e.target.value)} rows={4} placeholder={def}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent bg-slate-50/50 dark:bg-slate-800/50 transition-all resize-none font-mono leading-relaxed" />
                  </div>
                ))}
              </div>
            </div>
            {/* Save row */}
            <div className="px-5 md:px-8 py-4 flex justify-end bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={handleSaveTemplates} disabled={savingTpl}
                className="bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-all shadow-sm shadow-green-200">
                {savingTpl ? "Saving…" : "Save Templates"}
              </button>
            </div>
          </div>
        )}

        {/* ── Reminders ────────────────────────────────────────── */}
        {activeTab === "reminders" && !isPro && (
          <WhatsAppProGate />
        )}
        {activeTab === "reminders" && isPro && (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {/* Toggle + time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 md:px-8 py-6 md:py-7">
              <div className="pt-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center"><Bell size={12} className="text-amber-600" /></div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Daily Reminders</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Automatically message every tenant with unpaid rent once per day via WhatsApp.</p>
                <div className="mt-3 space-y-1 text-xs text-slate-400">
                  <p>✅ Only tenants with WhatsApp on</p>
                  <p>✅ Only OVERDUE payments</p>
                  <p>✅ At most once per day</p>
                  <p>✅ Uses platform WhatsApp Business number</p>
                </div>
              </div>
              <div className="md:col-span-2 space-y-5">
                <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Enable daily reminders</p>
                    <p className="text-xs text-slate-400 mt-0.5">Sends overdue notices automatically each day</p>
                  </div>
                  <button onClick={() => setAutoReminders(v => !v)} className={`relative w-12 h-6 rounded-full transition-all duration-200 focus:outline-none shrink-0 ${autoReminders ? "bg-amber-500" : "bg-slate-200 dark:bg-slate-600"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${autoReminders ? "translate-x-6" : "translate-x-0"}`} />
                  </button>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"><Clock size={11} />Send time (server local time)</label>
                  <select value={reminderHour} onChange={e => setReminderHour(parseInt(e.target.value))} disabled={!autoReminders}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-slate-50/50 dark:bg-slate-800/50 transition-all disabled:opacity-40">
                    {Array.from({ length: 24 }, (_, h) => {
                      const label = h === 0 ? "12:00 AM" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`;
                      return <option key={h} value={h}>{label}</option>;
                    })}
                  </select>
                </div>
                <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3">
                  <span className="text-xs text-slate-400 font-medium">Last run</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {reminderLastRun ? new Date(reminderLastRun + "T00:00:00").toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : "Never"}
                  </span>
                </div>
              </div>
            </div>
            {/* Save row */}
            <div className="px-5 md:px-8 py-4 flex justify-end bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={handleSaveReminders} disabled={savingReminders}
                className="bg-amber-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-all shadow-sm shadow-amber-200">
                {savingReminders ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* ── Backup ───────────────────────────────────────────── */}
        {activeTab === "backup" && (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {/* Download */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 md:px-8 py-6 md:py-7">
              <div className="pt-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center"><Download size={12} className="text-violet-600" /></div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Download Backup</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Exports all rooms, tenants, payments, charges and settings as a JSON file. Login credentials are excluded.</p>
              </div>
              <div className="md:col-span-2 flex items-center">
                <a href="/api/backup?confirm=1" download
                  className="inline-flex items-center gap-2.5 bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
                  <Download size={14} />Download Backup
                </a>
              </div>
            </div>
            {/* Restore */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 md:px-8 py-6 md:py-7">
              <div className="pt-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-rose-100 flex items-center justify-center"><Upload size={12} className="text-rose-500" /></div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Restore from Backup</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Upload a previously downloaded JSON backup. <strong className="text-rose-500">All current data will be replaced.</strong> This cannot be undone.</p>
              </div>
              <div className="md:col-span-2">
                <RestoreBackup />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function RestoreBackup() {
  const [file,        setFile]        = useState<File | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [confirmed,   setConfirmed]   = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRestore = async () => {
    if (!file || !confirmed) return;
    setConfirmOpen(false);
    setLoading(true);
    try {
      const json = JSON.parse(await file.text());
      const res  = await fetch("/api/backup/restore", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restore failed");
      toast.success(`Restored — ${data.restored.rooms} rooms, ${data.restored.tenants} tenants, ${data.restored.payments} payments`);
      setFile(null);
      setConfirmed(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="cursor-pointer inline-flex items-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
        <Upload size={14} />
        {file ? <span className="max-w-[180px] truncate text-violet-700 font-bold">{file.name}</span> : "Choose backup file…"}
        <input type="file" accept=".json,application/json" className="hidden"
          onChange={e => { setFile(e.target.files?.[0] ?? null); setConfirmed(false); }} />
      </label>

      {file && (
        <>
          <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-rose-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-rose-700 font-medium">This will <strong>permanently delete all current data</strong> and replace it with the contents of this backup file.</p>
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="w-3.5 h-3.5 accent-rose-600" />
                <span className="text-xs text-rose-800 font-semibold">I understand — proceed with restore</span>
              </label>
            </div>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!confirmed || loading}
            className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm shadow-rose-200"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            {loading ? "Restoring…" : "Restore Backup"}
          </button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Restore Backup"
            description="This will permanently replace ALL current data with the backup. This cannot be undone."
            confirmLabel="Yes, Restore"
            variant="destructive"
            loading={loading}
            onConfirm={handleRestore}
          />
        </>
      )}
    </div>
  );
}
