"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Settings } from "lucide-react";

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
  const [customCode, setCustomCode]     = useState("");
  const [saving, setSaving]             = useState(false);
  const [loaded, setLoaded]             = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const code   = data["currency_code"]   ?? "NPR";
        const symbol = data["currency_symbol"] ?? "रू";
        const preset = PRESETS.find((p) => p.code === code && p.code !== "CUSTOM");
        if (preset) {
          setSelectedCode(code);
        } else {
          setSelectedCode("CUSTOM");
          setCustomSymbol(symbol);
          setCustomCode(code);
        }
        setLoaded(true);
      });
  }, []);

  const currentSymbol = selectedCode === "CUSTOM"
    ? customSymbol
    : PRESETS.find((p) => p.code === selectedCode)?.symbol ?? "रू";
  const currentCode = selectedCode === "CUSTOM" ? customCode : selectedCode;

  const handleSave = async () => {
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
      toast.success("Settings saved — reload to apply currency changes");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Settings size={18} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">Configure app preferences</p>
        </div>
      </div>

      {/* Currency Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-slate-900">Currency</h2>
          <p className="text-xs text-slate-400 mt-0.5">Applied across all pages and reports</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => {
            const isSelected = selectedCode === preset.code;
            return (
              <button
                key={preset.code}
                onClick={() => setSelectedCode(preset.code)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50/60 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">{preset.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>
                    {preset.label}
                  </p>
                  <p className="text-xs text-slate-400">{preset.code}{preset.symbol ? ` · ${preset.symbol}` : ""}</p>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selectedCode === "CUSTOM" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Symbol</label>
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                placeholder="e.g. Fr."
                maxLength={5}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Code</label>
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                placeholder="e.g. CHF"
                maxLength={5}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {currentSymbol && (
          <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Preview</span>
            <span className="text-base font-bold text-slate-900">{currentSymbol}10,000</span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
