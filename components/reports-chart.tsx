"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type DataPoint = { month: string; collected: number; expenses: number; net: number };

// Custom tooltip — Recharts' inline `contentStyle` can't reach Tailwind's
// dark: variant, so we render our own that picks up the page's theme.
interface TooltipPayloadItem { name?: string; value?: number; color?: string }
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg dark:shadow-black/40 px-3.5 py-2.5 text-xs">
      <p className="font-bold mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
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

export function ReportsChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={2} barCategoryGap="30%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6366f1" stopOpacity={1} />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.85} />
          </linearGradient>
          <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#fb923c" stopOpacity={1} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0.85} />
          </linearGradient>
          <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#34d399" stopOpacity={1} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.85} />
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
          width={52}
        />
        <Tooltip
          // Translucent indigo cursor reads on both light + dark backgrounds.
          cursor={{ fill: "rgba(99, 102, 241, 0.12)" }}
          content={<ChartTooltip />}
        />
        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px", color: "#94a3b8" }} />
        <Bar dataKey="collected" name="Collected" fill="url(#gradCollected)" radius={[5, 5, 0, 0]} maxBarSize={32} />
        <Bar dataKey="expenses"  name="Expenses"  fill="url(#gradExpenses)"  radius={[5, 5, 0, 0]} maxBarSize={32} />
        <Bar dataKey="net"       name="Net"        fill="url(#gradNet)"       radius={[5, 5, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
