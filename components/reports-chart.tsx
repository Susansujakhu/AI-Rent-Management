"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";

type DataPoint = { month: string; collected: number; expenses: number; net: number };

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
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
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
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #f1f5f9",
            boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
            fontSize: "12px",
            padding: "10px 14px",
          }}
          cursor={{ fill: "#f8fafc" }}
        />
        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px", color: "#94a3b8" }} />
        <Bar dataKey="collected" name="Collected" fill="url(#gradCollected)" radius={[5, 5, 0, 0]} maxBarSize={32} />
        <Bar dataKey="expenses"  name="Expenses"  fill="url(#gradExpenses)"  radius={[5, 5, 0, 0]} maxBarSize={32} />
        <Bar dataKey="net"       name="Net"        fill="url(#gradNet)"       radius={[5, 5, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
