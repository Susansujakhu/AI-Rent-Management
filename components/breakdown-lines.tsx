"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type BreakdownData = {
  baseRent: number;
  charges: Array<{ title: string; amount: number }>;
};

export function BreakdownLines({
  breakdown,
  fmt,
}: {
  breakdown: BreakdownData;
  fmt: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);
  if (breakdown.charges.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-0.5 text-[10px] text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors mt-0.5"
      >
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {breakdown.charges.length} charge{breakdown.charges.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
          <div className="flex justify-between gap-3">
            <span>Base rent</span>
            <span className="tabular-nums">{fmt(breakdown.baseRent)}</span>
          </div>
          {breakdown.charges.map((c, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="text-violet-600 dark:text-violet-400 truncate">{c.title}</span>
              <span className="tabular-nums shrink-0">{fmt(c.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
