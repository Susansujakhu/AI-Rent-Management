export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { DeleteRoomButton } from "./delete-button";
import { AssignTenantPanel } from "./assign-tenant";
import { RecurringChargesPanel } from "./recurring-charges";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-green-100 text-green-800",
    PARTIAL: "bg-blue-100 text-blue-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    OVERDUE: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  // Tenants available to assign: no room set, or moved out (freed up)
  const unassignedTenants = await prisma.tenant.findMany({
    where: { OR: [{ roomId: null }, { moveOutDate: { not: null } }], },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      tenants: {
        where: { moveOutDate: null },
        take: 1,
      },
      payments: {
        include: { tenant: true },
        orderBy: { month: "desc" },
        take: 12,
      },
      expenses: {
        orderBy: { date: "desc" },
        take: 5,
      },
      recurringCharges: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!room) notFound();

  const currentTenant = room.tenants[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/rooms" className="text-sm text-gray-500 hover:text-gray-700">Rooms</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-700">{room.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{room.name}</h1>
          {room.floor && <p className="text-sm text-gray-500">Floor: {room.floor}</p>}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/rooms/${id}/edit`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
          <DeleteRoomButton roomId={id} />
        </div>
      </div>

      {/* Room Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly Rent</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(room.monthlyRent)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
          <p className="text-lg font-semibold mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${currentTenant ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
              {currentTenant ? "Occupied" : "Vacant"}
            </span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Payments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{room.payments.length}</p>
        </div>
      </div>

      {room.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
          <p className="text-sm text-gray-600">{room.description}</p>
        </div>
      )}

      {/* Current Tenant */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Current Tenant</h2>
        {currentTenant ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{currentTenant.name}</p>
              <p className="text-sm text-gray-500">{currentTenant.phone}</p>
              <p className="text-xs text-gray-400 mt-1">
                Move-in: {formatDate(currentTenant.moveInDate)}
              </p>
            </div>
            <Link
              href={`/tenants/${currentTenant.id}`}
              className="text-sm text-blue-600 hover:underline"
            >
              View Profile →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <AssignTenantPanel roomId={id} unassignedTenants={unassignedTenants} />
            <div className="text-center text-xs text-gray-400">
              or{" "}
              <Link href={`/tenants/new?roomId=${id}`} className="text-blue-600 hover:underline">
                add a new tenant
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Recurring Charges */}
      <RecurringChargesPanel
        roomId={id}
        charges={room.recurringCharges.filter((c) => c.tenantId === null)}
        monthlyRent={room.monthlyRent}
        currencySymbol={settings.currencySymbol}
      />

      {/* Payment History */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Payment History (Last 12 Months)</h2>
        </div>
        {room.payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No payments yet.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {room.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{formatMonth(p.month)}</p>
                  <p className="text-xs text-gray-500">{p.tenant.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-gray-900">
                      {fmt(p.amountPaid)} / {fmt(p.amountDue)}
                    </p>
                    {p.paidDate && (
                      <p className="text-xs text-gray-400">{formatDate(p.paidDate)}</p>
                    )}
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
