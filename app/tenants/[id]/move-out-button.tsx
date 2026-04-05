"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function MoveOutButton({
  tenantId,
  moveInDate,
}: {
  tenantId: string;
  moveInDate: string; // ISO date string
}) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const minDate = new Date(moveInDate).toISOString().split("T")[0];

  const handleConfirm = async () => {
    if (date < minDate) {
      toast.error("Move-out date cannot be before move-in date");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveOutDate: date }),
      });
      if (!res.ok) throw new Error();
      toast.success("Tenant marked as moved out");
      setShowPicker(false);
      router.refresh();
    } catch {
      toast.error("Failed to update tenant");
    } finally {
      setLoading(false);
    }
  };

  if (!showPicker) {
    return (
      <button
        onClick={() => setShowPicker(true)}
        className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
      >
        Move Out
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
      <label className="text-sm text-orange-800 font-medium whitespace-nowrap">Move-out date:</label>
      <input
        type="date"
        value={date}
        min={minDate}
        max={new Date().toISOString().split("T")[0]}
        onChange={(e) => setDate(e.target.value)}
        className="border border-orange-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="bg-orange-500 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
      >
        {loading ? "..." : "Confirm"}
      </button>
      <button
        onClick={() => setShowPicker(false)}
        className="text-gray-500 hover:text-gray-700 text-sm px-2"
      >
        Cancel
      </button>
    </div>
  );
}
