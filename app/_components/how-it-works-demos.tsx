"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Bell, CheckCircle2, MousePointer2, CreditCard, ChevronRight, Calendar, MessageCircle } from "lucide-react";

// Cycle through `frames` indices, advancing every `intervalMs` ms.
function useFrameLoop(frames: number, intervalMs = 1900) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(v => (v + 1) % frames), intervalMs);
    return () => clearInterval(t);
  }, [frames, intervalMs]);
  return i;
}

// ─── Shared tokens — copied from components/payments-view.tsx so the demos
//     stay visually identical to the real screens. ───────────────────────────

const AVATAR_PALETTE = [
  "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400",
  "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
  "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
  "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400",
  "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400",
];
function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const cls = size === "sm" ? "w-6 h-6 text-[9px]" : "w-8 h-8 text-[11px]";
  return (
    <div className={`${cls} rounded-full flex items-center justify-center font-bold shrink-0 ${AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length]}`}>
      {initials}
    </div>
  );
}

const STATUS_COLOR = {
  OVERDUE: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/20",
  PARTIAL: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/20",
  PENDING: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/20",
  PAID:    "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/20",
} as const;
const STATUS_DOT = { OVERDUE: "bg-rose-500", PARTIAL: "bg-blue-500", PENDING: "bg-amber-400", PAID: "bg-emerald-500" } as const;
type Status = keyof typeof STATUS_COLOR;

function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLOR[status]}`}>
      <span className={`w-1 h-1 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </span>
  );
}

// Simulated mouse cursor that moves between frames.
function Cursor({ visible, top, left }: { visible: boolean; top: number; left: number }) {
  return (
    <div
      className="absolute pointer-events-none transition-all duration-500 ease-out z-30"
      style={{ top: `${top}%`, left: `${left}%`, opacity: visible ? 1 : 0, transform: "translate(-2px, -2px)" }}
    >
      <MousePointer2 size={16} className="text-slate-900 dark:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] fill-white dark:fill-slate-900" />
    </div>
  );
}

const cardCls =
  "relative w-full max-w-[320px] aspect-[3/2.5] bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-md shadow-slate-200/40 dark:shadow-slate-900/40 overflow-hidden";

// ─── Demo 1: Add a room ──────────────────────────────────────────────────────

export function AddRoomDemo() {
  const f = useFrameLoop(3, 1900);

  return (
    <div className={cardCls}>
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-white leading-none">Rooms</p>
          <p className="text-[9px] text-slate-400 mt-0.5">2 rooms · 1 vacant</p>
        </div>
        <button
          className={`inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg shadow-sm transition-all duration-300 ${
            f === 0 ? "ring-2 ring-indigo-300/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105" : ""
          }`}
        >
          <Plus size={10} /> Add Room
        </button>
      </div>

      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {[
          { name: "Room 101", rent: "रू 7,500", tenant: "Ravi Sharma" },
          { name: "Room 102", rent: "रू 8,000", tenant: "Priya Nair"  },
        ].map(r => (
          <div key={r.name} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 dark:text-slate-400">
                {r.name.split(" ")[1]}
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-none">{r.name}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{r.tenant}</p>
              </div>
            </div>
            <span className="text-[10px] font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">{r.rent}</span>
          </div>
        ))}

        {/* New row */}
        <div
          className={`px-4 py-2.5 flex items-center justify-between transition-all duration-500 ${
            f === 2 ? "opacity-100 bg-emerald-50/50 dark:bg-emerald-500/10" : "opacity-0"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 size={13} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 leading-none">Room 103</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Vacant</p>
            </div>
          </div>
          <span className="text-[10px] font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">रू 7,500</span>
        </div>
      </div>

      {/* Form modal — frame 1 */}
      <div
        className={`absolute inset-x-4 bottom-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/15 px-4 py-3 transition-all duration-400 ${
          f === 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">New room</p>
        <div className="space-y-1.5">
          <div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Name</p>
            <div className="rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-2 py-1.5 flex items-center text-[11px]">
              <span className="font-semibold text-slate-800 dark:text-slate-100">Room 103</span>
              <span className="w-0.5 h-3 bg-indigo-500 ml-0.5 animate-[demo-blink_1s_steps(2)_infinite]" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Monthly rent</span>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">रू 7,500</span>
          </div>
        </div>
        <div className="mt-2.5 flex justify-end">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg">
            <Save size={10} /> Save Room
          </span>
        </div>
      </div>

      <Cursor visible={f === 0} top={20} left={84} />
      <Cursor visible={f === 1} top={88} left={80} />

      <style>{`@keyframes demo-blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

// ─── Demo 2: Add a tenant ────────────────────────────────────────────────────

export function AddTenantDemo() {
  const f = useFrameLoop(3, 1900);

  return (
    <div className={cardCls}>
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-white leading-none">Tenants</p>
          <p className="text-[9px] text-slate-400 mt-0.5">2 active</p>
        </div>
        <button
          className={`inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg shadow-sm transition-all duration-300 ${
            f === 0 ? "ring-2 ring-indigo-300/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105" : ""
          }`}
        >
          <Plus size={10} /> Add Tenant
        </button>
      </div>

      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {[
          { name: "Ravi Sharma", sub: "Room 101 · since Jan 2025" },
          { name: "Priya Nair",  sub: "Room 102 · since Sep 2025" },
        ].map(t => (
          <div key={t.name} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
            <Avatar name={t.name} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-none">{t.name}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{t.sub}</p>
            </div>
            <span className="text-[9px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20 px-1.5 py-0.5 rounded-full">
              Active
            </span>
          </div>
        ))}

        {/* New tenant */}
        <div
          className={`px-4 py-2.5 flex items-center gap-2.5 transition-all duration-500 ${
            f === 2 ? "opacity-100 bg-emerald-50/50 dark:bg-emerald-500/10" : "opacity-0"
          }`}
        >
          <Avatar name="Anita Karki" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 leading-none">Anita Karki</p>
            <p className="text-[9px] text-slate-400 mt-0.5">Room 103 · today</p>
          </div>
          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
        </div>
      </div>

      {/* Form modal — frame 1 */}
      <div
        className={`absolute inset-x-4 bottom-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/15 px-4 py-3 transition-all duration-400 ${
          f === 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">New tenant</p>
        <div className="space-y-1.5 text-[10px]">
          <div className="rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-2 py-1.5 flex items-center">
            <span className="text-slate-400 text-[9px]">Name</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100 ml-auto text-[11px]">Anita Karki</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-2 py-1.5 flex items-center">
              <span className="text-slate-400 text-[9px]">Room</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 ml-auto text-[10px]">103 ▾</span>
            </div>
            <div className="rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-2 py-1.5 flex items-center gap-1">
              <Calendar size={9} className="text-slate-400" />
              <span className="font-semibold text-slate-800 dark:text-slate-100 ml-auto text-[10px]">Apr 24</span>
            </div>
          </div>
        </div>
      </div>

      <Cursor visible={f === 0} top={20} left={86} />
      <Cursor visible={f === 1} top={88} left={78} />
    </div>
  );
}

// ─── Demo 3: Track & collect ─────────────────────────────────────────────────

export function TrackCollectDemo() {
  const f = useFrameLoop(3, 2000);

  return (
    <div className={cardCls}>
      {/* Header — matches Payments page style */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-white leading-none">Open Bills</p>
          <p className="text-[9px] text-slate-400 mt-0.5">April 2026</p>
        </div>
        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-500/20">
          1 open
        </span>
      </div>

      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {/* The animated row */}
        <div className={`px-4 py-3 flex items-center gap-2.5 ${f < 2 ? "border-l-2 border-rose-400" : "border-l-2 border-emerald-400"}`}>
          <Avatar name="Priya Nair" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-none">Priya Nair</p>
            <p className="text-[9px] text-slate-400 mt-0.5">Room 102 · Apr 14 – May 14</p>
          </div>
          <div className="text-right shrink-0 mr-1">
            <p className="text-[11px] font-black text-slate-900 dark:text-white leading-none tabular-nums">रू 7,500</p>
            <p className="text-[9px] text-slate-400 mt-0.5">due</p>
          </div>
          <StatusPill status={f < 2 ? "OVERDUE" : "PAID"} />
        </div>

        {/* Action row */}
        <div className="px-4 py-2 flex items-center justify-end gap-1.5 bg-slate-50/40 dark:bg-slate-800/30">
          <button
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition-all duration-300 ${
              f === 0
                ? "bg-indigo-600 text-white ring-2 ring-indigo-300/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105"
                : f === 2
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20"
                  : "bg-indigo-600 text-white"
            }`}
          >
            {f === 2 ? <CheckCircle2 size={10} /> : <CreditCard size={10} />}
            {f === 2 ? "Paid" : "Pay"}
          </button>
          <button className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg">
            <Bell size={12} />
          </button>
          <button className="p-1.5 text-slate-400 rounded-lg">
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Record-payment overlay — frame 1 */}
      <div
        className={`absolute inset-x-4 bottom-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/15 px-4 py-3 transition-all duration-400 ${
          f === 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Record payment</p>
        <div className="rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-2.5 py-2 flex items-center">
          <span className="text-slate-400 text-[9px]">Amount paid</span>
          <span className="font-black text-slate-900 dark:text-white text-[13px] ml-auto">रू 7,500</span>
          <span className="w-0.5 h-3.5 bg-indigo-500 ml-0.5 animate-[demo-blink_1s_steps(2)_infinite]" />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[9px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">CASH</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg">
            <Save size={10} /> Record
          </span>
        </div>
      </div>

      {/* WhatsApp receipt toast — frame 2 */}
      <div
        className={`absolute right-3 top-14 rounded-xl bg-[#128c7e] text-white px-3 py-2 shadow-xl shadow-emerald-900/30 flex items-center gap-2 transition-all duration-500 ${
          f === 2 ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
        }`}
      >
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <MessageCircle size={11} />
        </div>
        <div className="leading-tight">
          <p className="text-[10px] font-bold">Receipt sent</p>
          <p className="text-[8px] text-white/70 mt-0.5">Priya Nair · 10:32 ✓✓</p>
        </div>
      </div>

      <Cursor visible={f === 0} top={62} left={32} />
      <Cursor visible={f === 1} top={86} left={82} />

      <style>{`@keyframes demo-blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}
