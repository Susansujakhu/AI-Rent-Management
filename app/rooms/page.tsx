export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { Plus, DoorOpen, Users } from "lucide-react";

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

  const occupied = rooms.filter((r) => r.tenants.length > 0).length;
  const vacant = rooms.length - occupied;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rooms</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="text-emerald-600 font-medium">{occupied} occupied</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-slate-400">{vacant} vacant</span>
          </p>
        </div>
        <Link
          href="/rooms/new"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
        >
          <Plus size={15} />
          Add Room
        </Link>
      </div>

      {rooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <DoorOpen size={22} className="text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm font-medium">No rooms yet</p>
          <Link href="/rooms/new" className="text-indigo-600 text-sm underline mt-1.5 inline-block">
            Add your first room
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const activeTenant = room.tenants[0];
            const isOccupied = !!activeTenant;
            return (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="group bg-white rounded-2xl border border-slate-100 p-5 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50 transition-all block"
              >
                {/* Top accent bar */}
                <div className={`h-1 w-12 rounded-full mb-4 ${isOccupied ? "bg-emerald-400" : "bg-slate-200"}`} />

                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{room.name}</h2>
                    {room.floor && (
                      <p className="text-xs text-slate-400 mt-0.5">Floor {room.floor}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    isOccupied ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {isOccupied ? "Occupied" : "Vacant"}
                  </span>
                </div>

                <p className="text-2xl font-bold text-slate-900">
                  {fmt(room.monthlyRent)}
                  <span className="text-sm font-normal text-slate-400">/mo</span>
                </p>

                <div className="mt-3 pt-3 border-t border-slate-50">
                  {activeTenant ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                        {activeTenant.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-700 font-medium">{activeTenant.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Users size={13} />
                      <span className="text-xs">No tenant assigned</span>
                    </div>
                  )}
                </div>

                {room.description && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-1">{room.description}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
