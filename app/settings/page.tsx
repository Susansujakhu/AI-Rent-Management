"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

const PRESETS = [
  { label: "NPR — Nepali Rupee", code: "NPR", symbol: "रू" },
  { label: "INR — Indian Rupee", code: "INR", symbol: "₹" },
  { label: "USD — US Dollar", code: "USD", symbol: "$" },
  { label: "EUR — Euro", code: "EUR", symbol: "€" },
  { label: "GBP — British Pound", code: "GBP", symbol: "£" },
  { label: "Custom", code: "CUSTOM", symbol: "" },
];

export default function SettingsPage() {
  const [selectedCode, setSelectedCode] = useState("NPR");
  const [customSymbol, setCustomSymbol] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const code = data["currency_code"] ?? "NPR";
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

  const currentSymbol =
    selectedCode === "CUSTOM"
      ? customSymbol
      : PRESETS.find((p) => p.code === selectedCode)?.symbol ?? "रू";

  const currentCode = selectedCode === "CUSTOM" ? customCode : selectedCode;

  const handleSave = async () => {
    if (!currentSymbol) { toast.error("Currency symbol is required"); return; }
    if (!currentCode) { toast.error("Currency code is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency_symbol: currentSymbol,
          currency_code: currentCode,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Settings saved — reload the page to see updated currency");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <div className="flex items-center justify-center h-48"><p className="text-gray-400 text-sm">Loading...</p></div>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure app preferences</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Currency</h2>

        <div className="space-y-2">
          {PRESETS.map((preset) => (
            <label
              key={preset.code}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedCode === preset.code
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="currency"
                value={preset.code}
                checked={selectedCode === preset.code}
                onChange={() => setSelectedCode(preset.code)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700 flex-1">{preset.label}</span>
              {preset.symbol && (
                <span className="text-sm font-bold text-gray-500 w-6 text-center">{preset.symbol}</span>
              )}
            </label>
          ))}
        </div>

        {selectedCode === "CUSTOM" && (
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                placeholder="e.g. Fr."
                maxLength={5}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                placeholder="e.g. CHF"
                maxLength={5}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {currentSymbol && (
          <p className="text-xs text-gray-500">
            Preview: <span className="font-semibold text-gray-800">{currentSymbol}10,000</span>
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
