"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function periodLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const nextIdx  = mo % 12;           // 0-based next month index
  const nextYear = mo === 12 ? y + 1 : y;
  return {
    label: `${MONTHS[mo - 1]}/${MONTHS[nextIdx]} ${nextYear}`,
    year:  y,
    moIdx: mo - 1,  // 0-based
  };
}

export function MonthPicker({ months, selected, currentMonth }: {
  months: string[];
  selected: string;
  currentMonth: string;
}) {
  const router    = useRouter();
  const btnRef    = useRef<HTMLButtonElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const [open,    setOpen]    = useState(false);
  const [viewYear, setViewYear] = useState(() => parseInt(selected.split("-")[0]));

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // Sync viewYear when selected changes externally
  useEffect(() => { setViewYear(parseInt(selected.split("-")[0])); }, [selected]);

  const { label, moIdx: selMoIdx } = periodLabel(selected);
  const selYear = parseInt(selected.split("-")[0]);
  const curYear = parseInt(currentMonth.split("-")[0]);
  const curMo   = parseInt(currentMonth.split("-")[1]) - 1; // 0-based

  const isPast = selected < currentMonth;

  const select = (m: string) => {
    setOpen(false);
    router.push(m === currentMonth ? "/dashboard" : `/dashboard?month=${m}`);
  };

  // Min year in available months
  const minYear = months.length > 0 ? parseInt(months[months.length - 1].split("-")[0]) : curYear;
  const maxYear = curYear;

  return (
    <div className="relative inline-block">
      {/* ── Trigger button ── */}
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className={`
          group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold
          transition-all duration-200 select-none
          ${isPast
            ? "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300"
            : "bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-300"
          }
          ${open ? (isPast ? "bg-amber-100 shadow-sm" : "bg-indigo-100 shadow-sm") : ""}
        `}
      >
        <Calendar size={13} className={isPast ? "text-amber-500" : "text-indigo-500"} />
        <span>{label}</span>
        <ChevronRight
          size={13}
          className={`transition-transform duration-200 ${open ? "rotate-90" : ""} ${isPast ? "text-amber-400" : "text-indigo-400"}`}
        />
      </button>

      {/* ── Floating panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
          style={{ minWidth: 280 }}
        >
          {/* Header — indigo gradient with year nav */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setViewYear(v => v - 1)}
              disabled={viewYear <= minYear}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-white font-bold text-base tracking-wide">{viewYear}</span>
            <button
              onClick={() => setViewYear(v => v + 1)}
              disabled={viewYear >= maxYear}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1.5 p-3">
            {MONTHS.map((name, i) => {
              const mStr     = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
              const isSel    = mStr === selected;
              const isCur    = viewYear === curYear && i === curMo;
              const isAvail  = months.includes(mStr);
              const isFuture = !isAvail && (viewYear > curYear || (viewYear === curYear && i > curMo));

              // Period label for tooltip
              const nextIdx  = (i + 1) % 12;
              const nextYear = i === 11 ? viewYear + 1 : viewYear;
              const tip      = `${name}/${MONTHS[nextIdx]} ${nextYear}`;

              return (
                <button
                  key={name}
                  title={tip}
                  disabled={isFuture || (!isAvail && !isSel)}
                  onClick={() => isAvail && select(mStr)}
                  className={`
                    relative flex flex-col items-center justify-center h-12 rounded-xl text-xs font-semibold
                    transition-all duration-150 select-none
                    ${isSel
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105"
                      : isCur
                        ? "bg-indigo-50 text-indigo-700 border-2 border-indigo-300 hover:bg-indigo-100"
                        : isAvail
                          ? "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                          : "text-slate-300 cursor-not-allowed"
                    }
                  `}
                >
                  <span>{name}</span>
                  {/* small dot under current */}
                  {isCur && !isSel && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-slate-50 bg-slate-50/60">
            <p className="text-[10px] text-slate-400 text-center">
              {selected === currentMonth ? "Showing current billing period" : `Viewing ${label}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
