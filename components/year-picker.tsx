"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function YearPicker({ year, minYear, maxYear }: { year: number; minYear: number; maxYear: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const go = (y: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(y));
    router.push(`/reports?${params.toString()}`);
  };

  const btnCls = "w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => go(year - 1)} disabled={year <= minYear} className={btnCls}>
        <ChevronLeft size={15} />
      </button>
      <span className="w-14 text-center text-sm font-bold text-slate-800 dark:text-slate-100">{year}</span>
      <button onClick={() => go(year + 1)} disabled={year >= maxYear} className={btnCls}>
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
