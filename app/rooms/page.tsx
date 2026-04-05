export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

export default async function RoomsPage() {
  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);
  const rooms = await prisma.room.findMany({
    include: {
      tenants: {
        where: { moveOutDate: null },
        select: { id: true, name: true, phone: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="text-sm text-gray-500 mt-1">{rooms.length} room{rooms.length !== 1 ? "s" : ""} total</p>
        </div>
        <Link
          href="/rooms/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Room
        </Link>
      </div>

      {rooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No rooms yet.</p>
          <Link href="/rooms/new" className="text-blue-600 text-sm underline mt-2 inline-block">
            Add your first room
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const activeTenant = room.tenants[0];
            const occupied = !!activeTenant;
            return (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">{room.name}</h2>
                    {room.floor && (
                      <p className="text-xs text-gray-400 mt-0.5">Floor: {room.floor}</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      occupied
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {occupied ? "Occupied" : "Vacant"}
                  </span>
                </div>
                <p className="text-xl font-bold text-gray-900">{fmt(room.monthlyRent)}<span className="text-sm font-normal text-gray-400">/mo</span></p>
                {activeTenant ? (
                  <p className="text-sm text-gray-600 mt-2">
                    Tenant: <span className="font-medium">{activeTenant.name}</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 mt-2">No current tenant</p>
                )}
                {room.description && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{room.description}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
