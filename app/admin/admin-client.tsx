"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Shield, Wifi, WifiOff, Users, Loader2, RefreshCw,
  Trash2, CheckCircle, XCircle, Crown, CalendarDays,
  ChevronUp, History, Zap, TrendingUp, ArrowLeft,
  Search, ChevronLeft, ChevronRight, AlertTriangle,
  CreditCard, UserCheck, Clock, Smartphone, QrCode,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "users" | "wa";
type DirectStatus = "disconnected" | "connecting" | "qr" | "ready";
interface WAState {
  mode:   "api" | "direct";
  api:    { configured: boolean; phoneNumberId: string | null };
  direct: { status: DirectStatus; phone: string | null; qrImage: string | null };
}

interface AdminUser {
  id: string; email: string; name: string | null; phone: string | null;
  phoneVerified: boolean; role: string; plan: string;
  planExpiresAt: string | null; billingCycle: string | null;
  pendingPlan: string | null; pendingBillingCycle: string | null;
  upgradeRequestedAt: string | null; createdAt: string;
  _count: { tenants: number; rooms: number; payments: number };
}

interface SubHistoryEntry {
  id: string; plan: string; billingCycle: string | null;
  expiresAt: string | null; note: string | null;
  changedBy: string; createdAt: string;
}

interface SubForm { plan: string; billingCycle: string; expiresAt: string }

interface Stats {
  users: { total: number; byPlan: Record<string, number>; onTrial: number; expired: number; pendingUpgrade: number; verified: number };
  revenue: { mrr: number; arr: number };
  expiringSoon: { id: string; email: string; name: string | null; plan: string; planExpiresAt: string; billingCycle: string | null; daysLeft: number }[];
  expiring7Days: number;
  growth: { month: string; count: number }[];
  recentActivity: { id: string; plan: string; billingCycle: string | null; note: string | null; changedBy: string; createdAt: string; user: { email: string; name: string | null } }[];
  pendingUsers: { id: string; email: string; name: string | null; upgradeRequestedAt: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-600", basic: "bg-indigo-100 text-indigo-700",
  starter: "bg-violet-100 text-violet-700", pro: "bg-amber-100 text-amber-700",
};
const PIE_COLORS: Record<string, string> = {
  free: "#94a3b8", basic: "#6366f1", starter: "#8b5cf6", pro: "#f59e0b",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
}

function calcExpiry(cycle: string) {
  if (cycle === "lifetime") return ""; // no expiry
  const d = new Date();
  if (cycle === "monthly") d.setMonth(d.getMonth() + 1);
  else if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function isExpired(iso: string | null) {
  return !!iso && new Date(iso) < new Date();
}

const PAGE_SIZE = 15;

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminClient() {
  const [tab, setTab] = useState<Tab>("overview");

  // WA
  const [wa,         setWa]         = useState<WAState>({ mode: "api", api: { configured: false, phoneNumberId: null }, direct: { status: "disconnected", phone: null, qrImage: null } });
  const [waActing,   setWaActing]   = useState(false);

  // Stats
  const [stats, setStats]             = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Users
  const [users, setUsers]                 = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading]   = useState(true);
  const [search, setSearch]               = useState("");
  const [filterPlan, setFilterPlan]       = useState("");
  const [filterStatus, setFilterStatus]   = useState("");
  const [page, setPage]                   = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // App settings (global)
  const [betaMode,        setBetaMode]        = useState(true);
  const [adminWhatsapp,   setAdminWhatsapp]   = useState("");
  const [savingAppConfig, setSavingAppConfig] = useState(false);

  // Subscription panel
  const [expandedSub, setExpandedSub]   = useState<string | null>(null);
  const [subForm, setSubForm]           = useState<SubForm>({ plan: "", billingCycle: "", expiresAt: "" });
  const [subHistory, setSubHistory]     = useState<SubHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [savingSubId, setSavingSubId]   = useState<string | null>(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchWA = useCallback(async () => {
    const r = await fetch("/api/admin/whatsapp");
    if (r.ok) {
      setWa(await r.json() as WAState);
    }
  }, []);

  const switchWAMode = async (newMode: "api" | "direct") => {
    if (wa.mode === newMode || waActing) return;
    setWaActing(true);
    const r = await fetch("/api/admin/whatsapp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_mode", mode: newMode }),
    });
    if (r.ok) { await fetchWA(); toast.success(`Switched to ${newMode === "api" ? "Meta Business API" : "Direct Connection"}`); }
    else toast.error("Failed to switch mode");
    setWaActing(false);
  };

  const connectDirect = async () => {
    setWaActing(true);
    await fetch("/api/admin/whatsapp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect_direct" }),
    });
    setTimeout(fetchWA, 800);
    setWaActing(false);
  };

  const disconnectDirect = async () => {
    setWaActing(true);
    await fetch("/api/admin/whatsapp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect_direct" }),
    });
    await fetchWA();
    toast.success("WhatsApp disconnected");
    setWaActing(false);
  };

  const fetchAppConfig = useCallback(async () => {
    const r = await fetch("/api/admin/app-settings");
    if (r.ok) {
      const d = await r.json() as Record<string, string>;
      setBetaMode(d["beta_mode"] !== "false");
      setAdminWhatsapp(d["admin_whatsapp"] ?? "");
    }
  }, []);

  const saveAppConfig = async () => {
    setSavingAppConfig(true);
    await fetch("/api/admin/app-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beta_mode: betaMode ? "true" : "false", admin_whatsapp: adminWhatsapp }),
    });
    toast.success("App settings saved");
    setSavingAppConfig(false);
  };

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const r = await fetch("/api/admin/stats");
    if (r.ok) setStats(await r.json() as Stats);
    setStatsLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    const r = await fetch("/api/admin/users");
    if (r.ok) setUsers(await r.json() as AdminUser[]);
    setUsersLoading(false);
  }, []);

  useEffect(() => { fetchWA(); fetchStats(); fetchUsers(); fetchAppConfig(); }, [fetchWA, fetchStats, fetchUsers, fetchAppConfig]);

  // Poll WA status every 3 s while direct connection is pending / QR shown
  useEffect(() => {
    if (wa.mode !== "direct" || (wa.direct.status !== "connecting" && wa.direct.status !== "qr")) return;
    const t = setInterval(fetchWA, 3_000);
    return () => clearInterval(t);
  }, [wa.mode, wa.direct.status, fetchWA]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterPlan, filterStatus]);

  // ── Filtered + paginated users ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => {
      if (q && !u.email.toLowerCase().includes(q) && !(u.name?.toLowerCase().includes(q)) && !(u.phone?.includes(q))) return false;
      if (filterPlan && u.plan !== filterPlan) return false;
      if (filterStatus === "verified"   && !u.phoneVerified)  return false;
      if (filterStatus === "unverified" &&  u.phoneVerified)  return false;
      if (filterStatus === "pending"    && !u.upgradeRequestedAt) return false;
      if (filterStatus === "expiring") {
        const d = daysLeft(u.planExpiresAt);
        if (d === null || d < 0 || d > 30) return false;
      }
      if (filterStatus === "expired" && !isExpired(u.planExpiresAt)) return false;
      return true;
    });
  }, [users, search, filterPlan, filterStatus]);

  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);

  // ── User actions ──────────────────────────────────────────────────────────
  const patchUser = async (id: string, data: Record<string, unknown>, label: string) => {
    setActionLoading(id + label);
    const r = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (r.ok) {
      const updated = await r.json() as AdminUser;
      setUsers(u => u.map(x => x.id === id ? { ...x, ...updated } : x));
      toast.success("User updated");
    } else {
      toast.error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Failed");
    }
    setActionLoading(null);
  };

  const deleteUser = async (id: string) => {
    setActionLoading(id + "delete");
    const r = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (r.ok) { setUsers(u => u.filter(x => x.id !== id)); toast.success("User deleted"); if (expandedSub === id) setExpandedSub(null); }
    else toast.error("Failed to delete user");
    setActionLoading(null); setConfirmDelete(null);
  };

  // ── Subscription panel ────────────────────────────────────────────────────
  const fetchHistory = useCallback(async (uid: string) => {
    setHistoryLoading(true);
    const r = await fetch(`/api/admin/users/${uid}/subscriptions`);
    if (r.ok) setSubHistory(await r.json() as SubHistoryEntry[]);
    setHistoryLoading(false);
  }, []);

  const openSubPanel = (u: AdminUser) => {
    if (expandedSub === u.id) { setExpandedSub(null); return; }
    setExpandedSub(u.id);
    setSubForm({ plan: u.plan, billingCycle: u.billingCycle ?? "", expiresAt: u.planExpiresAt ? u.planExpiresAt.slice(0, 10) : "" });
    fetchHistory(u.id);
  };

  const saveSub = async (uid: string) => {
    setSavingSubId(uid);
    const r = await fetch(`/api/admin/users/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: subForm.plan, billingCycle: subForm.billingCycle || null, planExpiresAt: subForm.expiresAt || null }),
    });
    if (r.ok) {
      const updated = await r.json() as AdminUser;
      setUsers(u => u.map(x => x.id === uid ? { ...x, ...updated } : x));
      toast.success("Subscription updated"); fetchHistory(uid);
      // refresh stats after a plan change
      fetchStats();
    } else {
      toast.error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Failed");
    }
    setSavingSubId(null);
  };

  // ── Pie chart data ────────────────────────────────────────────────────────
  const pieData = stats ? [
    { name: "Free",    value: stats.users.byPlan.free    ?? 0, color: PIE_COLORS.free    },
    { name: "Basic",   value: stats.users.byPlan.basic   ?? 0, color: PIE_COLORS.basic   },
    { name: "Starter", value: stats.users.byPlan.starter ?? 0, color: PIE_COLORS.starter },
    { name: "Pro",     value: stats.users.byPlan.pro     ?? 0, color: PIE_COLORS.pro     },
  ].filter(d => d.value > 0) : [];

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpis = stats ? [
    { label: "Total Users",     value: stats.users.total,          icon: Users,         bg: "bg-indigo-50",  ic: "text-indigo-600" },
    { label: "Paid Plans",      value: (stats.users.byPlan.basic ?? 0) + (stats.users.byPlan.starter ?? 0) + (stats.users.byPlan.pro ?? 0), icon: CreditCard, bg: "bg-amber-50", ic: "text-amber-600" },
    { label: "On Trial",        value: stats.users.onTrial,        icon: Zap,           bg: "bg-violet-50",  ic: "text-violet-600" },
    { label: "Expiring ≤ 30d",  value: stats.expiringSoon.length,  icon: CalendarDays,  bg: "bg-orange-50",  ic: "text-orange-500" },
    { label: "Pending Upgrade", value: stats.users.pendingUpgrade, icon: TrendingUp,    bg: "bg-green-50",   ic: "text-green-600"  },
    { label: "Est. MRR",        value: `Rs. ${stats.revenue.mrr.toLocaleString()}`, icon: CreditCard, bg: "bg-teal-50", ic: "text-teal-600" },
  ] : [];

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-lg hidden sm:block">Admin Dashboard</span>
            <span className="font-bold text-slate-800 text-lg sm:hidden">Admin</span>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-1 flex-1 justify-center">
            {(["overview", "users", "wa"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}>
                {t === "overview" ? "Overview" : t === "users" ? `Users (${users.length})` : "WhatsApp"}
              </button>
            ))}
          </nav>

          {/* Back to app */}
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:block">Back to app</span>
          </Link>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">

        {/* ════════════════ OVERVIEW TAB ════════════════ */}
        {tab === "overview" && (
          <div className="space-y-6">

            {/* KPI Cards */}
            {statsLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-slate-400 animate-spin" /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {kpis.map(k => (
                    <div key={k.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                      <div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center`}>
                        <k.icon className={`w-4.5 h-4.5 ${k.ic}`} />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-slate-800">{k.value}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                  {/* User Growth */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-800">User Growth</h3>
                      <span className="text-xs text-slate-400">Last 12 months</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={stats!.growth.map(g => ({ ...g, month: fmtMonth(g.month) }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                        <Area type="monotone" dataKey="count" name="New Users" stroke="#6366f1" strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Plan Distribution */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col">
                    <h3 className="font-semibold text-slate-800 mb-4">Plan Distribution</h3>
                    <div className="flex-1 flex items-center justify-center">
                      {pieData.length === 0 ? (
                        <p className="text-sm text-slate-400">No data</p>
                      ) : (
                        <div className="flex flex-col items-center gap-3 w-full">
                          <PieChart width={160} height={160}>
                            <Pie data={pieData} cx={80} cy={80} innerRadius={50} outerRadius={72} dataKey="value" paddingAngle={2}>
                              {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                          </PieChart>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full">
                            {pieData.map(e => (
                              <div key={e.name} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} />
                                <span className="text-xs text-slate-600">{e.name} <span className="font-semibold">({e.value})</span></span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom row: Expiring Soon + Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* Expiring Soon */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-orange-500" />
                        <h3 className="font-semibold text-slate-800 text-sm">Expiring Soon</h3>
                      </div>
                      <span className="text-xs text-slate-400">Next 30 days</span>
                    </div>
                    {stats!.expiringSoon.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400">No subscriptions expiring soon</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {stats!.expiringSoon.map(u => (
                          <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{u.email}</p>
                              <p className="text-xs text-slate-400">{fmtDate(u.planExpiresAt)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[u.plan] ?? PLAN_COLORS.free}`}>{cap(u.plan)}</span>
                              <span className={`text-xs font-bold ${u.daysLeft <= 3 ? "text-red-500" : u.daysLeft <= 7 ? "text-orange-500" : "text-slate-500"}`}>
                                {u.daysLeft}d
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Subscription Activity */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-500" />
                      <h3 className="font-semibold text-slate-800 text-sm">Recent Subscription Activity</h3>
                    </div>
                    {stats!.recentActivity.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400">No recent activity</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {stats!.recentActivity.map(a => (
                          <div key={a.id} className="px-5 py-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-slate-800 truncate">{a.user.email}</p>
                              <p className="text-xs text-slate-400 mt-0.5 truncate">{a.note ?? `→ ${cap(a.plan)}`}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[a.plan] ?? PLAN_COLORS.free}`}>{cap(a.plan)}</span>
                              <span className="text-xs text-slate-400">{fmtDate(a.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Pending Upgrades */}
                {stats!.pendingUsers.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                      <h3 className="font-semibold text-orange-800 text-sm">{stats!.pendingUsers.length} pending upgrade request{stats!.pendingUsers.length > 1 ? "s" : ""}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {stats!.pendingUsers.map(u => (
                        <button key={u.id} onClick={() => { setTab("users"); setSearch(u.email); }}
                          className="text-xs bg-white border border-orange-200 rounded-lg px-3 py-1.5 text-orange-700 hover:bg-orange-100 transition-colors font-medium">
                          {u.email}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              {/* ── App Settings ── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-violet-500" />
                  <h3 className="font-semibold text-slate-800 text-sm">App Settings</h3>
                </div>
                <div className="px-5 py-5 space-y-5">

                  {/* Beta Mode toggle */}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Beta Mode</p>
                      <p className="text-xs text-slate-400 mt-0.5">Shows a &ldquo;BETA – Free access&rdquo; badge instead of upgrade prompts. Turn off when paid plans go live.</p>
                    </div>
                    <button
                      onClick={() => setBetaMode(v => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${betaMode ? "bg-violet-600" : "bg-slate-200"}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${betaMode ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>

                  {/* Admin WhatsApp number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin WhatsApp Number</label>
                    <input
                      type="tel"
                      value={adminWhatsapp}
                      onChange={e => setAdminWhatsapp(e.target.value)}
                      placeholder="+977 98XXXXXXXX"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white"
                    />
                    <p className="text-xs text-slate-400">Shown in the app as a contact number for support or OTP assistance.</p>
                  </div>

                  <button onClick={saveAppConfig} disabled={savingAppConfig}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {savingAppConfig ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle className="w-4 h-4" />Save Settings</>}
                  </button>
                </div>
              </div>

              </>
            )}
          </div>
        )}

        {/* ════════════════ USERS TAB ════════════════ */}
        {tab === "users" && (
          <div className="space-y-4">

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email, name, phone…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-colors" />
              </div>

              {/* Plan filter */}
              <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">All Plans</option>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
              </select>

              {/* Status filter */}
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
                <option value="pending">Pending Upgrade</option>
                <option value="expiring">Expiring ≤ 30d</option>
                <option value="expired">Expired</option>
              </select>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-slate-400">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
                <button onClick={() => { fetchUsers(); fetchStats(); }} title="Refresh"
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {usersLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>
              ) : paginated.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No users match your filters</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {paginated.map(u => {
                    const days   = daysLeft(u.planExpiresAt);
                    const expired = isExpired(u.planExpiresAt);
                    const isOpen  = expandedSub === u.id;

                    return (
                      <div key={u.id}>
                        {/* User row */}
                        <div className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">

                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                            {(u.name ?? u.email).charAt(0).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-slate-800 text-sm truncate">{u.email}</span>
                              {u.role === "admin" && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                                  <Crown className="w-3 h-3" />admin
                                </span>
                              )}
                              {u.upgradeRequestedAt && u.pendingPlan && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                                  <Zap className="w-3 h-3" />Pending: {cap(u.pendingPlan)}
                                </span>
                              )}
                              {!expired && days !== null && days <= 7 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                                  <Clock className="w-3 h-3" />{days}d left
                                </span>
                              )}
                              {expired && u.plan !== "free" && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-medium">
                                  <XCircle className="w-3 h-3" />Expired
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                              {u.name && <span>{u.name}</span>}
                              <span>{u._count.rooms}r · {u._count.tenants}t · {u._count.payments}p</span>
                              <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                              {u.plan !== "free" && u.planExpiresAt && (
                                <span className={expired ? "text-red-400" : ""}>{expired ? "Expired" : "Expires"} {fmtDate(u.planExpiresAt)}</span>
                              )}
                              {u.phoneVerified
                                ? <span className="flex items-center gap-0.5 text-green-600"><UserCheck className="w-3 h-3" />verified</span>
                                : <span className="text-slate-400">unverified</span>
                              }
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Plan badge */}
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${PLAN_COLORS[u.plan] ?? PLAN_COLORS.free}`}>
                              {cap(u.plan)}
                            </span>

                            {/* Subscription manage */}
                            <button onClick={() => openSubPanel(u)} title="Manage subscription"
                              className={`p-2 rounded-xl transition-colors ${isOpen ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"}`}>
                              {isOpen ? <ChevronUp className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
                            </button>

                            {/* Role */}
                            <button onClick={() => patchUser(u.id, { role: u.role === "admin" ? "user" : "admin" }, "role")}
                              disabled={!!actionLoading} title={u.role === "admin" ? "Remove admin" : "Make admin"}
                              className={`p-2 rounded-xl transition-colors ${u.role === "admin" ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "text-slate-400 hover:bg-slate-100"} disabled:opacity-40`}>
                              <Crown className="w-4 h-4" />
                            </button>

                            {/* Verify */}
                            <button onClick={() => patchUser(u.id, { phoneVerified: !u.phoneVerified }, "verify")}
                              disabled={!!actionLoading} title={u.phoneVerified ? "Mark unverified" : "Mark verified"}
                              className={`p-2 rounded-xl transition-colors ${u.phoneVerified ? "bg-green-100 text-green-700 hover:bg-green-200" : "text-slate-400 hover:bg-slate-100"} disabled:opacity-40`}>
                              {u.phoneVerified ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            </button>

                            {/* Delete */}
                            {confirmDelete === u.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => deleteUser(u.id)} disabled={actionLoading === u.id + "delete"}
                                  className="px-2.5 py-1.5 bg-red-600 text-white text-xs rounded-lg font-medium hover:bg-red-700 disabled:opacity-50">
                                  {actionLoading === u.id + "delete" ? "…" : "Confirm"}
                                </button>
                                <button onClick={() => setConfirmDelete(null)}
                                  className="px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete(u.id)}
                                className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete user">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Subscription panel */}
                        {isOpen && (
                          <div className="border-t border-indigo-100 bg-indigo-50/40 px-5 py-5 space-y-5">

                            {/* Pending notice */}
                            {u.upgradeRequestedAt && u.pendingPlan && (
                              <div className="flex items-center justify-between gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                                <div className="text-sm">
                                  <span className="font-semibold text-orange-800">Pending upgrade request</span>
                                  <span className="text-orange-600 ml-2">
                                    {cap(u.pendingPlan)}{u.pendingBillingCycle && ` · ${u.pendingBillingCycle}`} · Requested {fmtDate(u.upgradeRequestedAt)}
                                  </span>
                                </div>
                                <button onClick={() => {
                                  const cycle = u.pendingBillingCycle ?? "monthly";
                                  setSubForm({ plan: u.pendingPlan!, billingCycle: cycle, expiresAt: calcExpiry(cycle) });
                                }} className="shrink-0 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 transition-colors">
                                  Apply
                                </button>
                              </div>
                            )}

                            {/* Form */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</label>
                                <select value={subForm.plan} onChange={e => {
                                  const plan = e.target.value;
                                  setSubForm(f => ({
                                    ...f, plan,
                                    expiresAt: plan !== "free" && f.billingCycle ? calcExpiry(f.billingCycle) : plan === "free" ? "" : f.expiresAt,
                                    billingCycle: plan === "free" ? "" : f.billingCycle,
                                  }));
                                }} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                  <option value="free">Free</option>
                                  <option value="basic">Basic — Rs.199/mo</option>
                                  <option value="starter">Starter — Rs.299/mo</option>
                                  <option value="pro">Pro — Rs.499/mo</option>
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Billing Cycle</label>
                                <select value={subForm.billingCycle} disabled={subForm.plan === "free"} onChange={e => {
                                  const cycle = e.target.value;
                                  setSubForm(f => ({ ...f, billingCycle: cycle, expiresAt: cycle ? calcExpiry(cycle) : "" }));
                                }} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-40">
                                  <option value="">— Select —</option>
                                  <option value="monthly">Monthly (+1 month)</option>
                                  <option value="yearly">Yearly (+1 year)</option>
                                  <option value="lifetime">Lifetime (no expiry)</option>
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expires On</label>
                                  {subForm.billingCycle && subForm.billingCycle !== "lifetime" && subForm.plan !== "free" && (
                                    <button type="button" onClick={() => setSubForm(f => ({ ...f, expiresAt: calcExpiry(f.billingCycle) }))}
                                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                      <RefreshCw className="w-3 h-3" />Renew from today
                                    </button>
                                  )}
                                </div>
                                <input type="date" value={subForm.expiresAt}
                                  disabled={subForm.plan === "free" || subForm.billingCycle === "lifetime"}
                                  onChange={e => setSubForm(f => ({ ...f, expiresAt: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-40" />
                                {subForm.billingCycle === "lifetime" && subForm.plan !== "free" ? (
                                  <p className="text-xs text-emerald-600 font-medium">No expiry — permanent access</p>
                                ) : subForm.expiresAt && subForm.plan !== "free" ? (
                                  <p className="text-xs text-slate-400">
                                    {Math.ceil((new Date(subForm.expiresAt).getTime() - Date.now()) / 86_400_000)} days from today
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <button onClick={() => saveSub(u.id)} disabled={savingSubId === u.id}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                              {savingSubId === u.id ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle className="w-4 h-4" />Save Subscription</>}
                            </button>

                            {/* History */}
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <History className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subscription History</span>
                              </div>
                              {historyLoading ? (
                                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
                              ) : subHistory.length === 0 ? (
                                <p className="text-xs text-slate-400">No history yet.</p>
                              ) : (
                                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200">
                                        {["Date","Plan","Cycle","Expires","By"].map(h => (
                                          <th key={h} className="text-left px-3 py-2 text-slate-500 font-semibold">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {subHistory.map(h => (
                                        <tr key={h.id} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 text-slate-500">{fmtDate(h.createdAt)}</td>
                                          <td className="px-3 py-2">
                                            <span className={`px-1.5 py-0.5 rounded font-semibold ${PLAN_COLORS[h.plan] ?? PLAN_COLORS.free}`}>{cap(h.plan)}</span>
                                          </td>
                                          <td className="px-3 py-2 text-slate-500 capitalize">{h.billingCycle ?? "—"}</td>
                                          <td className="px-3 py-2 text-slate-500">{fmtDate(h.expiresAt)}</td>
                                          <td className="px-3 py-2">
                                            <span className={`px-1.5 py-0.5 rounded text-xs ${h.changedBy === "system" ? "bg-slate-100 text-slate-500" : "bg-indigo-50 text-indigo-600"}`}>
                                              {h.changedBy}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="text-sm text-slate-600 px-3">
                  Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ WHATSAPP TAB ════════════════ */}
        {tab === "wa" && (
          <div className="max-w-xl space-y-4">

            {/* Mode selector */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">WhatsApp Mode</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => switchWAMode("api")}
                  disabled={waActing}
                  className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 transition-colors text-left disabled:opacity-60 ${wa.mode === "api" ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                >
                  <div className="flex items-center gap-2">
                    <Wifi className={`w-4 h-4 ${wa.mode === "api" ? "text-indigo-600" : "text-slate-400"}`} />
                    <span className={`text-sm font-semibold ${wa.mode === "api" ? "text-indigo-700" : "text-slate-600"}`}>Meta Business API</span>
                    {wa.mode === "api" && <CheckCircle className="w-3.5 h-3.5 text-indigo-500 ml-auto" />}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">Official Meta API. Requires phone number ID &amp; access token.</p>
                </button>

                <button
                  onClick={() => switchWAMode("direct")}
                  disabled={waActing}
                  className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 transition-colors text-left disabled:opacity-60 ${wa.mode === "direct" ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className={`w-4 h-4 ${wa.mode === "direct" ? "text-indigo-600" : "text-slate-400"}`} />
                    <span className={`text-sm font-semibold ${wa.mode === "direct" ? "text-indigo-700" : "text-slate-600"}`}>Direct (QR)</span>
                    {wa.mode === "direct" && <CheckCircle className="w-3.5 h-3.5 text-indigo-500 ml-auto" />}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">Scan QR with your phone. Works without a business account.</p>
                </button>
              </div>
            </div>

            {/* ── API mode card ── */}
            {wa.mode === "api" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-5 h-5 text-green-600" />
                    <h2 className="font-semibold text-slate-800">WhatsApp Business API</h2>
                  </div>
                  <span className={`text-sm font-medium ${wa.api.configured ? "text-green-500" : "text-slate-400"}`}>
                    {wa.api.configured ? "Active" : "Not configured"}
                  </span>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <p className="text-sm text-slate-500">
                    Sends OTP codes, payment receipts, and overdue reminders via Meta&apos;s official cloud API.
                  </p>
                  {wa.api.configured ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
                      <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm text-green-700 font-medium">Connected via Business API</p>
                        {wa.api.phoneNumberId && <p className="text-xs text-green-600 mt-0.5">Phone Number ID: {wa.api.phoneNumberId}</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-amber-700 font-medium">API credentials not set</p>
                        <p className="text-xs text-amber-600 mt-1">Add these to your <code className="bg-amber-100 px-1 rounded">.env</code> file and restart:</p>
                        <pre className="mt-2 text-xs bg-slate-100 rounded-lg p-2 text-slate-700 leading-relaxed">{`WHATSAPP_PHONE_NUMBER_ID=your_id\nWHATSAPP_ACCESS_TOKEN=your_token`}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Direct mode card ── */}
            {wa.mode === "direct" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-600" />
                    <h2 className="font-semibold text-slate-800">Direct WhatsApp Connection</h2>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    wa.direct.status === "ready"      ? "bg-green-100 text-green-700"   :
                    wa.direct.status === "qr"         ? "bg-blue-100 text-blue-700"     :
                    wa.direct.status === "connecting" ? "bg-amber-100 text-amber-700"   :
                                                       "bg-slate-100 text-slate-500"
                  }`}>
                    {wa.direct.status === "ready" ? "Connected" : wa.direct.status === "qr" ? "Scan QR" : wa.direct.status === "connecting" ? "Connecting…" : "Disconnected"}
                  </span>
                </div>
                <div className="px-6 py-5 space-y-4">

                  {wa.direct.status === "disconnected" && (
                    <>
                      <p className="text-sm text-slate-500">Connect by scanning a QR code with the WhatsApp on your phone. The session persists across server restarts.</p>
                      <button onClick={connectDirect} disabled={waActing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {waActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                        Connect WhatsApp
                      </button>
                    </>
                  )}

                  {wa.direct.status === "connecting" && (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin shrink-0" />
                      <div>
                        <p className="text-sm text-amber-700 font-medium">Initialising connection…</p>
                        <p className="text-xs text-amber-600 mt-0.5">QR code will appear in a moment.</p>
                      </div>
                    </div>
                  )}

                  {wa.direct.status === "qr" && wa.direct.qrImage && (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-slate-600 text-center">Open WhatsApp on your phone → <strong>Linked Devices</strong> → <strong>Link a Device</strong> and scan:</p>
                      <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={wa.direct.qrImage} alt="WhatsApp QR Code" className="w-56 h-56" />
                      </div>
                      <p className="text-xs text-slate-400">QR code refreshes automatically. This page polls every 3 s.</p>
                    </div>
                  )}

                  {wa.direct.status === "ready" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                        <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                        <div>
                          <p className="text-sm text-green-700 font-medium">WhatsApp connected</p>
                          {wa.direct.phone && <p className="text-xs text-green-600 mt-0.5">+{wa.direct.phone}</p>}
                        </div>
                      </div>
                      <button onClick={disconnectDirect} disabled={waActing}
                        className="flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-600 text-sm font-medium rounded-xl hover:bg-rose-50 disabled:opacity-50 transition-colors">
                        {waActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <WifiOff className="w-4 h-4" />}
                        Disconnect
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
