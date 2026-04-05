export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Plus, Users, ChevronRight, Phone, Calendar } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { Suspense } from "react";

const AVATAR_COLORS = [
  "from-indigo-500 to-violet-500",
  "from-violet-500 to-purple-500",
  "from-blue-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const STATUS_STYLES: Record<string, { pill: string; dot: string; label: string }> = {
  PAID:    { pill: "bg-emerald-50 text-emerald-700 border border-emerald-100", dot: "bg-emerald-500", label: "Paid" },
  PARTIAL: { pill: "bg-blue-50 text-blue-700 border border-blue-100",         dot: "bg-blue-500",    label: "Partial" },
  OVERDUE: { pill: "bg-rose-50 text-rose-700 border border-rose-100",         dot: "bg-rose-500",    label: "Overdue" },
  PENDING: { pill: "bg-amber-50 text-amber-700 border border-amber-100",      dot: "bg-amber-500",   label: "Pending" },
};

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search } = await searchParams;
  const allTenants = await prisma.tenant.findMany({
    where: search ? {
      OR: [
        { name: { contains: search } },
        { phone: { contains: search } },
        { room: { name: { contains: search } } },
      ],
    } : undefined,
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
      <div className="flex items-start justify-between gap-4">
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
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-200 shrink-0"
        >
          <Plus size={15} />
          Add Tenant
        </Link>
      </div>

      {/* Search */}
      <Suspense>
        <SearchInput placeholder="Search by name, phone or room…" />
      </Suspense>

      {/* Active Tenants */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">
            Active Tenants
          </h2>
          <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-100">
            {activeTenants.length}
          </span>
        </div>

        {activeTenants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-14 text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <Users size={24} className="text-indigo-400" />
            </div>
            <p className="text-slate-700 font-semibold text-sm">No active tenants</p>
            <p className="text-slate-400 text-xs mt-1 mb-4">
              {search ? `No results for "${search}"` : "Add tenants to start tracking rent"}
            </p>
            {!search && (
              <Link
                href="/tenants/new"
                className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Plus size={13} />
                Add Tenant
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTenants.map((tenant) => {
              const latestPayment = tenant.payments[0];
              const status = latestPayment ? STATUS_STYLES[latestPayment.status] : null;
              const gradient = avatarColor(tenant.name);
              return (
                <Link
                  key={tenant.id}
                  href={`/tenants/${tenant.id}`}
                  className="group bg-white rounded-2xl border border-slate-100 p-5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50/60 transition-all block"
                >
                  {/* Top row: avatar + name + status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg bg-gradient-to-br ${gradient} text-white shadow-sm shrink-0`}
                      >
                        {tenant.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors leading-tight">
                          {tenant.name}
                        </p>
                        <p className="text-xs font-medium text-indigo-500 mt-0.5">
                          {tenant.room ? tenant.room.name : (
                            <span className="text-amber-500">No room</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {status && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${status.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot} inline-block`} />
                        {status.label}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5">
                    {tenant.phone && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        <span className="text-xs">{tenant.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar size={12} className="text-slate-400 shrink-0" />
                      <span className="text-xs">Since {formatDate(tenant.moveInDate)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Tenants */}
      {pastTenants.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-500 text-sm uppercase tracking-wide">
              Past Tenants
            </h2>
            <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
              {pastTenants.length}
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
                      <p className="text-xs text-slate-400 mt-0.5">
                        {tenant.room?.name ?? "—"}
                        <span className="mx-1.5 text-slate-300">·</span>
                        Moved out: {tenant.moveOutDate ? formatDate(tenant.moveOutDate) : "—"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-slate-300 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
