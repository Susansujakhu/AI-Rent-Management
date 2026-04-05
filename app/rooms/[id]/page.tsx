export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { DeleteRoomButton } from "./delete-button";
import { AssignTenantPanel } from "./assign-tenant";
import { RecurringChargesPanel } from "./recurring-charges";
import { ChevronRight } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID:    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    PARTIAL: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    OVERDUE: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  const unassignedTenants = await prisma.tenant.findMany({
    where: { OR: [{ roomId: null }, { moveOutDate: { not: null } }] },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      tenants:         { where: { moveOutDate: null }, take: 1 },
      payments:        { include: { tenant: true }, orderBy: { month: "desc" }, take: 12 },
      expenses:        { orderBy: { date: "desc" }, take: 5 },
      recurringCharges: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!room) notFound();

  const currentTenant = room.tenants[0];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-1">
            <Link href="/rooms" className="hover:text-slate-600 transition-colors">Rooms</Link>
            <ChevronRight size={14} />
            <span className="text-slate-600">{room.name}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">{room.name}</h1>
            {room.floor && <span className="text-sm text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{room.floor}</span>}
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${currentTenant ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-500"}`}>
              {currentTenant ? "Occupied" : "Vacant"}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/rooms/${id}/edit`}
            className="border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            Edit
          </Link>
          <DeleteRoomButton roomId={id} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Monthly Rent</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(room.monthlyRent)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Payments Recorded</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{room.payments.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Expenses</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{room.expenses.length}</p>
        </div>
      </div>

      {room.description && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Description</p>
          <p className="text-sm text-slate-600">{room.description}</p>
        </div>
      )}

      {/* Current Tenant */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Current Tenant</h2>
        {currentTenant ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800">{currentTenant.name}</p>
              <p className="text-sm text-slate-400">{currentTenant.phone}</p>
              <p className="text-xs text-slate-400 mt-1">Move-in: {formatDate(currentTenant.moveInDate)}</p>
            </div>
            <Link href={`/tenants/${currentTenant.id}`}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
              View Profile →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <AssignTenantPanel roomId={id} unassignedTenants={unassignedTenants} />
            <div className="text-center text-xs text-slate-400">
              or{" "}
              <Link href={`/tenants/new?roomId=${id}`} className="text-indigo-600 hover:underline">
                add a new tenant
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Recurring Charges */}
      <RecurringChargesPanel
        roomId={id}
        charges={room.recurringCharges.filter(c => c.tenantId === null)}
        monthlyRent={room.monthlyRent}
        currencySymbol={settings.currencySymbol}
      />

      {/* Payment History */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Payment History</h2>
          <span className="text-xs text-slate-400">Last 12 months</span>
        </div>
        {room.payments.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No payments yet.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {room.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{formatMonth(p.month)}</p>
                  <p className="text-xs text-slate-400">{p.tenant.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">{fmt(p.amountPaid)} / {fmt(p.amountDue)}</p>
                    {p.paidDate && <p className="text-xs text-slate-400">{formatDate(p.paidDate)}</p>}
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
