"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type UnassignedTenant = {
  id: string;
  name: string;
  phone: string;
};

export function AssignTenantPanel({
  roomId,
  unassignedTenants,
}: {
  roomId: string;
  unassignedTenants: UnassignedTenant[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    if (!selectedId) {
      toast.error("Please select a tenant");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, moveOutDate: null }),
      });
      if (!res.ok) throw new Error();
      toast.success("Tenant assigned to room");
      router.refresh();
    } catch {
      toast.error("Failed to assign tenant");
    } finally {
      setLoading(false);
    }
  };

  if (unassignedTenants.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-2">
        No available tenants. Add a new tenant below.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-slate-200"
      >
        <option value="">— Select tenant —</option>
        {unassignedTenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.phone})
          </option>
        ))}
      </select>
      <button
        onClick={handleAssign}
        disabled={loading || !selectedId}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {loading ? "Assigning..." : "Assign"}
      </button>
    </div>
  );
}
