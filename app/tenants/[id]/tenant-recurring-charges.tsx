"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { currentMonth } from "@/lib/utils";

type Charge = { id: string; title: string; amount: number; effectiveFrom: string | null };

export function TenantRecurringChargesPanel({
  tenantId,
  roomId,
  roomCharges,
  tenantCharges,
  currencySymbol,
  moveInMonth,
}: {
  tenantId: string;
  roomId: string;
  roomCharges: Charge[];
  tenantCharges: Charge[];
  currencySymbol: string;
  moveInMonth: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const defaultMonth = currentMonth() >= moveInMonth ? currentMonth() : moveInMonth;
  const [effectiveFrom, setEffectiveFrom] = useState(defaultMonth);
  const [saving, setSaving] = useState(false);

  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString()}`;

  const handleAdd = async () => {
    if (!title.trim() || !amount) return;
    if (effectiveFrom < moveInMonth) {
      toast.error(`Effective from cannot be before move-in month (${moveInMonth})`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/recurring-charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), amount: Number(amount), effectiveFrom }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      setAmount("");
      setEffectiveFrom(currentMonth());
      toast.success("Charge added");
      router.refresh();
    } catch {
      toast.error("Failed to add charge");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (chargeId: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/charges/${chargeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Charge removed");
      router.refresh();
    } catch {
      toast.error("Failed to remove charge");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-semibold text-gray-900">Recurring Charges</h2>

      {/* Room-level charges — read only */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Room-level (all tenants)
        </p>
        {roomCharges.length === 0 ? (
          <p className="text-sm text-gray-400">No room-level charges.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {roomCharges.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="text-sm text-gray-600">{c.title}</span>
                  {c.effectiveFrom && (
                    <span className="ml-2 text-xs text-gray-400">from {c.effectiveFrom}</span>
                  )}
                </div>
                <span className="text-sm text-gray-700">{fmt(c.amount)}/mo</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tenant-specific charges — editable */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Tenant-specific (this tenant only)
        </p>
        {tenantCharges.length === 0 ? (
          <p className="text-sm text-gray-400 mb-2">No tenant-specific charges.</p>
        ) : (
          <div className="divide-y divide-gray-50 mb-2">
            {tenantCharges.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="text-sm text-gray-700">{c.title}</span>
                  {c.effectiveFrom && (
                    <span className="ml-2 text-xs text-gray-400">from {c.effectiveFrom}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{fmt(c.amount)}/mo</span>
                  <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add tenant-specific charge form */}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Internet"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount ${currencySymbol}`}
              className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-gray-500 whitespace-nowrap">Effective from</label>
              <input
                type="month"
                value={effectiveFrom}
                min={moveInMonth}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saving || !title.trim() || !amount}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
