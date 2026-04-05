export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Plus, Users, ChevronRight } from "lucide-react";

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const STATUS_STYLES: Record<string, string> = {
  PAID:    "bg-emerald-50 text-emerald-700 border border-emerald-100",
  PARTIAL: "bg-blue-50 text-blue-700 border border-blue-100",
  OVERDUE: "bg-rose-50 text-rose-700 border border-rose-100",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-100",
};

export default async function TenantsPage() {
  const allTenants = await prisma.tenant.findMany({
    include: {
      room: true,
      payments: { orderBy: { month: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const activeTenants = allTenants.filter((t) => !t.moveOutDate);
  const pastTenants   = allTenants.filter((t) => !!t.moveOutDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="text-indigo-600 font-medium">{activeTenants.length} active</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-slate-400">{pastTenants.length} past</span>
          </p>
        </div>
        <Link
          href="/tenants/new"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
        >
          <Plus size={15} />
          Add Tenant
        </Link>
      </div>

      {/* Active Tenants */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Active Tenants</h2>
          <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg">{activeTenants.length}</span>
        </div>
        {activeTenants.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm">No active tenants.{" "}
              <Link href="/tenants/new" className="text-indigo-600 underline">Add one</Link>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {activeTenants.map((tenant) => {
              const latestPayment = tenant.payments[0];
              return (
                <Link
                  key={tenant.id}
                  href={`/tenants/${tenant.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${avatarColor(tenant.name)}`}>
                      {tenant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {tenant.room ? tenant.room.name : <span className="text-amber-500">No room</span>}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {tenant.phone}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Since {formatDate(tenant.moveInDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {latestPayment && (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLES[latestPayment.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {latestPayment.status}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Tenants */}
      {pastTenants.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-500">Past Tenants</h2>
            <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg">{pastTenants.length}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {pastTenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`/tenants/${tenant.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">
                    {tenant.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">{tenant.name}</p>
                    <p className="text-xs text-slate-400">
                      {tenant.room?.name ?? "—"} · Moved out: {tenant.moveOutDate ? formatDate(tenant.moveOutDate) : "—"}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
