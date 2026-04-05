export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function TenantsPage() {
  const allTenants = await prisma.tenant.findMany({
    include: {
      room: true,
      payments: {
        orderBy: { month: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const activeTenants = allTenants.filter((t) => !t.moveOutDate);
  const pastTenants = allTenants.filter((t) => !!t.moveOutDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeTenants.length} active · {pastTenants.length} past
          </p>
        </div>
        <Link
          href="/tenants/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Tenant
        </Link>
      </div>

      {/* Active Tenants */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Active Tenants ({activeTenants.length})</h2>
        </div>
        {activeTenants.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No active tenants.{" "}
            <Link href="/tenants/new" className="text-blue-600 underline">
              Add one
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activeTenants.map((tenant) => {
              const latestPayment = tenant.payments[0];
              return (
                <Link
                  key={tenant.id}
                  href={`/tenants/${tenant.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors block"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                      {tenant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                      <p className="text-xs text-gray-500">
                        {tenant.room ? tenant.room.name : "No room assigned"} · {tenant.phone}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Since {formatDate(tenant.moveInDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {latestPayment && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          latestPayment.status === "PAID"
                            ? "bg-green-100 text-green-800"
                            : latestPayment.status === "PARTIAL"
                            ? "bg-blue-100 text-blue-800"
                            : latestPayment.status === "OVERDUE"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {latestPayment.status}
                      </span>
                    )}
                    <span className="text-gray-300 text-sm">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Tenants */}
      {pastTenants.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Past Tenants ({pastTenants.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pastTenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`/tenants/${tenant.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors block"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">{tenant.name}</p>
                  <p className="text-xs text-gray-400">
                    {tenant.room?.name ?? "—"} · Moved out: {tenant.moveOutDate ? formatDate(tenant.moveOutDate) : "—"}
                  </p>
                </div>
                <span className="text-gray-300 text-sm">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
