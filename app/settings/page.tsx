"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Settings, Eye, EyeOff, Coins, ShieldCheck, DatabaseBackup, Download, UserCog } from "lucide-react";

const PRESETS = [
  { label: "Nepali Rupee", code: "NPR", symbol: "रू", flag: "🇳🇵" },
  { label: "Indian Rupee",  code: "INR", symbol: "₹",  flag: "🇮🇳" },
  { label: "US Dollar",    code: "USD", symbol: "$",   flag: "🇺🇸" },
  { label: "Euro",         code: "EUR", symbol: "€",   flag: "🇪🇺" },
  { label: "British Pound",code: "GBP", symbol: "£",   flag: "🇬🇧" },
  { label: "Custom",       code: "CUSTOM", symbol: "",  flag: "✏️" },
];

export default function SettingsPage() {
  const [selectedCode, setSelectedCode] = useState("NPR");
  const [customSymbol, setCustomSymbol] = useState("");
  const [customCode,   setCustomCode]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [loaded,       setLoaded]       = useState(false);

  // Account info
  const [userEmail,    setUserEmail]    = useState("");

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
  }, []);

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
    <div className="space-y-6 max-w-lg">
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
          <a href="/api/backup" download
            className="inline-flex items-center gap-2.5 bg-gradient-to-r from-slate-800 to-slate-700 text-white px-5 py-3 rounded-xl text-sm font-bold hover:from-slate-700 hover:to-slate-600 transition-all shadow-md shadow-slate-300/60">
            <Download size={15} />
            Download Backup
          </a>
        </div>
      </div>
    </div>
  );
}
