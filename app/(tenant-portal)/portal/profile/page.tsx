export const dynamic = "force-dynamic";

import { requireTenantPage } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { PortalShell } from "../_components/portal-shell";
import { Phone, Mail, Home, Calendar, Shield } from "lucide-react";

export default async function PortalProfilePage() {
  const session  = await requireTenantPage();
  const tenant   = session.tenant;
  const settings = await getSettings();
  const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);

  const propertyName = (await prisma.setting.findUnique({ where: { key: "propertyName" } }))?.value ?? "Property";

  return (
    <PortalShell tenantName={tenant.name} roomName={tenant.room?.name ?? null}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your tenancy details</p>
        </div>

        {/* Avatar */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white text-xl font-black shrink-0">
            {tenant.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-slate-900">{tenant.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{propertyName}</p>
          </div>
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact</h2>
          </div>
          <div className="divide-y divide-slate-50">
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                <Phone size={14} className="text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Phone</p>
                <p className="text-sm font-medium text-slate-800">{tenant.phone}</p>
              </div>
            </div>
            {tenant.email && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <Mail size={14} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="text-sm font-medium text-slate-800">{tenant.email}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tenancy info */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tenancy</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {tenant.room && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <Home size={14} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Room</p>
                  <p className="text-sm font-medium text-slate-800">{tenant.room.name}</p>
                  {tenant.room.floor && <p className="text-xs text-slate-400">{tenant.room.floor}</p>}
                </div>
              </div>
            )}
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                <Calendar size={14} className="text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Move-in Date</p>
                <p className="text-sm font-medium text-slate-800">{formatDate(tenant.moveInDate)}</p>
              </div>
            </div>
            {tenant.moveOutDate && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <Calendar size={14} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Move-out Date</p>
                  <p className="text-sm font-medium text-slate-800">{formatDate(tenant.moveOutDate)}</p>
                </div>
              </div>
            )}
            {tenant.deposit > 0 && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <Shield size={14} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Security Deposit</p>
                  <p className="text-sm font-medium text-slate-800">{fmt(tenant.deposit)}</p>
                </div>
              </div>
            )}
            {tenant.creditBalance > 0 && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                  <Shield size={14} className="text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Advance Credit</p>
                  <p className="text-sm font-bold text-teal-700">{fmt(tenant.creditBalance)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-xs text-center text-slate-400">
          To update your details, contact your landlord.
        </p>
      </div>
    </PortalShell>
  );
}
