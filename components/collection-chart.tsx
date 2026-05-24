"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type DataPoint = { month: string; due: number; collected: number };

interface TooltipPayloadItem { name?: string; value?: number; color?: string; stroke?: string }
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg dark:shadow-black/40 px-3.5 py-2.5 text-xs">
      <p className="font-bold mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.stroke }} />
            <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
            <span className="font-semibold tabular-nums ml-auto">
              {new Intl.NumberFormat("en").format(p.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CollectionChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradDue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#cbd5e1" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ stroke: "rgba(99, 102, 241, 0.45)", strokeWidth: 1 }}
          content={<ChartTooltip />}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", paddingTop: "12px", color: "#94a3b8" }}
        />
        <Area
          type="monotone"
          dataKey="due"
          name="Due"
          stroke="#cbd5e1"
          strokeWidth={2}
          fill="url(#gradDue)"
          dot={false}
          activeDot={{ r: 4, fill: "#cbd5e1" }}
        />
        <Area
          type="monotone"
          dataKey="collected"
          name="Collected"
          stroke="#4f46e5"
          strokeWidth={2.5}
          fill="url(#gradCollected)"
          dot={false}
          activeDot={{ r: 5, fill: "#4f46e5", strokeWidth: 2, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
