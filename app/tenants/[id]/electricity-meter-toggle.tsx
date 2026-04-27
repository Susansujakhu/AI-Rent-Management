"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";

export function ElectricityMeterToggle({
  tenantId,
  canSubmit,
  autoAccept,
}: {
  tenantId:   string;
  canSubmit:  boolean;
  autoAccept: boolean;
}) {
  const [submit, setSubmit]   = useState(canSubmit);
  const [auto,   setAuto]     = useState(autoAccept);
  const [loading, setLoading] = useState(false);

  const update = async (patch: { canSubmitMeterReading?: boolean; meterReadingAutoAccept?: boolean }) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      if (patch.canSubmitMeterReading !== undefined) {
        setSubmit(patch.canSubmitMeterReading);
        toast.success(patch.canSubmitMeterReading ? "Tenant can now submit meter readings" : "Meter reading submission disabled");
        if (!patch.canSubmitMeterReading && auto) {
          // also turn off auto-accept when disabling submission
          await fetch(`/api/tenants/${tenantId}`, {
            method:  "PUT",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ meterReadingAutoAccept: false }),
          });
          setAuto(false);
        }
      }
      if (patch.meterReadingAutoAccept !== undefined) {
        setAuto(patch.meterReadingAutoAccept);
        toast.success(patch.meterReadingAutoAccept ? "Readings will be auto-confirmed" : "Readings require your review");
      }
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Main toggle */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${submit ? "bg-amber-50 dark:bg-amber-500/15" : "bg-slate-50 dark:bg-slate-800"}`}>
            <Zap size={16} className={submit ? "text-amber-500" : "text-slate-400"} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tenant Meter Readings</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {submit ? "Tenant can submit meter readings via portal" : "Tenant cannot submit meter readings"}
            </p>
          </div>
        </div>
        <button
          onClick={() => update({ canSubmitMeterReading: !submit })}
          disabled={loading}
          className={`relative w-11 h-6 rounded-full transition-all duration-200 focus:outline-none disabled:opacity-50 ${submit ? "bg-amber-500" : "bg-slate-200"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${submit ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Auto-accept sub-toggle (only shown when submission is enabled) */}
      {submit && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="pl-12">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Auto-confirm readings</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {auto ? "Charges created automatically on submission" : "You review each reading before it&apos;s charged"}
            </p>
          </div>
          <button
            onClick={() => update({ meterReadingAutoAccept: !auto })}
            disabled={loading}
            className={`relative w-9 h-5 rounded-full transition-all duration-200 focus:outline-none disabled:opacity-50 shrink-0 ${auto ? "bg-emerald-500" : "bg-slate-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${auto ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>
      )}
    </div>
  );
}
