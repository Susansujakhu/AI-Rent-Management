"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type DataPoint = { month: string; due: number; collected: number };

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
          width={48}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #f1f5f9",
            boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
            fontSize: "12px",
            padding: "10px 14px",
          }}
          cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }}
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
