export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { DeleteRoomButton } from "./delete-button";
import { AssignTenantPanel } from "./assign-tenant";
import { RecurringChargesPanel } from "./recurring-charges";
import { ChevronRight, DoorOpen, Banknote, CreditCard, Wrench, UserCheck, UserX } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID:    "bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-100",
    PARTIAL: "bg-blue-50 text-blue-700 border border-blue-200 ring-1 ring-blue-100",
    PENDING: "bg-amber-50 text-amber-700 border border-amber-200 ring-1 ring-amber-100",
    OVERDUE: "bg-rose-50 text-rose-700 border border-rose-200 ring-1 ring-rose-100",
  };
  const dots: Record<string, string> = {
    PAID: "bg-emerald-500", PARTIAL: "bg-blue-500", PENDING: "bg-amber-400", OVERDUE: "bg-rose-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? "bg-slate-400"}`} />
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
      tenants:          { where: { moveOutDate: null }, take: 1 },
      payments:         { include: { tenant: true }, orderBy: { month: "desc" }, take: 12 },
      expenses:         { orderBy: { date: "desc" }, take: 5 },
      recurringCharges: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!room) notFound();

  const currentTenant = room.tenants[0];
  const totalCollected = room.payments.reduce((s, p) => s + p.amountPaid, 0);
  const paidCount = room.payments.filter(p => p.status === "PAID").length;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/rooms" className="hover:text-slate-600 transition-colors">Rooms</Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 font-medium">{room.name}</span>
      </div>

      {/* Hero card */}
      <div className={`relative rounded-2xl overflow-hidden p-6 ${currentTenant ? "bg-gradient-to-br from-indigo-500 to-indigo-700" : "bg-gradient-to-br from-slate-400 to-slate-600"}`}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-12 -translate-x-8" />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <DoorOpen size={18} className="text-white" />
              </div>
              {room.floor && (
                <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
                  {room.floor} Floor
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{room.name}</h1>
            {currentTenant ? (
              <p className="text-indigo-200 text-sm mt-1">
                Tenant: <span className="font-semibold text-white">{currentTenant.name}</span>
              </p>
            ) : (
              <p className="text-slate-300 text-sm mt-1 font-medium">Vacant — awaiting tenant</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wide">Monthly Rent</p>
            <p className="text-2xl font-black text-white mt-0.5">{fmt(room.monthlyRent)}</p>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2 mt-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            currentTenant ? "bg-emerald-400/30 text-white border border-emerald-300/30" : "bg-white/20 text-white border border-white/20"
          }`}>
            {currentTenant ? <UserCheck size={12} /> : <UserX size={12} />}
            {currentTenant ? "Occupied" : "Vacant"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link href={`/rooms/${id}/edit`}
          className="border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
          Edit Room
        </Link>
        <DeleteRoomButton roomId={id} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-emerald-400 rounded-l-2xl" />
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-3">
            <Banknote size={15} className="text-emerald-600" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Collected</p>
          <p className="text-xl font-black text-slate-900 mt-1 tracking-tight">{fmt(totalCollected)}</p>
          <p className="text-xs text-slate-400 mt-0.5">last 12 months</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-indigo-400 rounded-l-2xl" />
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
            <CreditCard size={15} className="text-indigo-600" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payments</p>
          <div className="mt-1 flex items-end gap-1">
            <p className="text-xl font-black text-slate-900 tracking-tight">{paidCount}</p>
            <p className="text-sm text-slate-400 font-medium mb-0.5">/ {room.payments.length}</p>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">paid in full</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-orange-400 rounded-l-2xl" />
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
            <Wrench size={15} className="text-orange-600" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expenses</p>
          <p className="text-xl font-black text-slate-900 mt-1 tracking-tight">{room.expenses.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">recorded</p>
        </div>
      </div>

      {room.description && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</p>
          <p className="text-sm text-slate-600">{room.description}</p>
        </div>
      )}

      {/* Current Tenant */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 mb-4 text-sm">Current Tenant</h2>
        {currentTenant ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                {currentTenant.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{currentTenant.name}</p>
                <p className="text-xs text-slate-400">{currentTenant.phone}</p>
                <p className="text-xs text-slate-400 mt-0.5">Since {formatDate(currentTenant.moveInDate)}</p>
              </div>
            </div>
            <Link href={`/tenants/${currentTenant.id}`}
              className="text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold px-3 py-1.5 rounded-lg transition-colors">
              View Profile →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <AssignTenantPanel roomId={id} unassignedTenants={unassignedTenants} />
            <div className="text-center text-xs text-slate-400">
              or{" "}
              <Link href={`/tenants/new?roomId=${id}`} className="text-indigo-600 hover:underline font-medium">
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
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Payment History</h2>
            <p className="text-xs text-slate-400 mt-0.5">Last 12 months</p>
          </div>
        </div>
        {room.payments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <CreditCard size={18} className="text-slate-300" />
            </div>
            <p className="text-sm text-slate-400">No payments recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {room.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{formatMonth(p.month)}</p>
                  <p className="text-xs text-slate-400">{p.tenant.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-900">{fmt(p.amountPaid)}</p>
                    <p className="text-xs text-slate-400">of {fmt(p.amountDue)}</p>
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
