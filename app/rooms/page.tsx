export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { Plus, DoorOpen, Users, Building2 } from "lucide-react";

// Deterministic accent color per room name
const ROOM_ACCENTS = [
  "from-indigo-500 to-violet-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-sky-500 to-blue-500",
  "from-purple-500 to-fuchsia-500",
];

function roomAccent(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ROOM_ACCENTS[Math.abs(hash) % ROOM_ACCENTS.length];
}

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
  const occupancyPct = rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Rooms</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="text-emerald-600 font-medium">{occupied} occupied</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-slate-400">{vacant} vacant</span>
          </p>
          {rooms.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex-1 max-w-[160px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${occupancyPct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-400">
                {occupied}/{rooms.length} occupied
              </span>
            </div>
          )}
        </div>
        <Link
          href="/rooms/new"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-200 shrink-0"
        >
          <Plus size={15} />
          Add Room
        </Link>
      </div>

      {rooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
            <Building2 size={24} className="text-indigo-400" />
          </div>
          <p className="text-slate-700 font-semibold text-sm">No rooms yet</p>
          <p className="text-slate-400 text-xs mt-1 mb-4">Add your first room to get started</p>
          <Link
            href="/rooms/new"
            className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Plus size={13} />
            Add Room
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map((room) => {
            const activeTenant = room.tenants[0];
            const isOccupied = !!activeTenant;
            const accent = roomAccent(room.name);

            return isOccupied ? (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="group bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50/60 transition-all overflow-hidden block"
              >
                {/* Colored top border */}
                <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-bold text-slate-900 text-base group-hover:text-indigo-700 transition-colors leading-tight">
                        {room.name}
                      </h2>
                      {room.floor && (
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <DoorOpen size={11} />
                          Floor {room.floor}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Occupied
                    </span>
                  </div>

                  <p className="text-3xl font-bold text-slate-900 tracking-tight">
                    {fmt(room.monthlyRent)}
                    <span className="text-sm font-normal text-slate-400 ml-1">/mo</span>
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm bg-gradient-to-br ${accent} text-white shadow-sm`}
                      >
                        {activeTenant.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{activeTenant.name}</p>
                        {activeTenant.phone && (
                          <p className="text-xs text-slate-400">{activeTenant.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {room.description && (
                    <p className="text-xs text-slate-400 mt-2.5 line-clamp-1">{room.description}</p>
                  )}
                </div>
              </Link>
            ) : (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="group bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all overflow-hidden block"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-bold text-slate-700 text-base group-hover:text-indigo-700 transition-colors leading-tight">
                        {room.name}
                      </h2>
                      {room.floor && (
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <DoorOpen size={11} />
                          Floor {room.floor}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                      Vacant
                    </span>
                  </div>

                  <p className="text-3xl font-bold text-slate-500 tracking-tight">
                    {fmt(room.monthlyRent)}
                    <span className="text-sm font-normal text-slate-400 ml-1">/mo</span>
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-slate-400">
                    <div className="w-8 h-8 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                      <Users size={13} />
                    </div>
                    <span className="text-xs font-medium">No tenant assigned</span>
                  </div>

                  {room.description && (
                    <p className="text-xs text-slate-400 mt-2.5 line-clamp-1">{room.description}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
