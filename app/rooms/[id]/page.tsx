export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { DeleteRoomButton } from "./delete-button";
import { AssignTenantPanel } from "./assign-tenant";
import { RecurringChargesPanel } from "./recurring-charges";
import { TenantRecurringChargesPanel } from "../../tenants/[id]/tenant-recurring-charges";
import { OneTimeChargesPanel } from "../../tenants/[id]/one-time-charges-panel";
import { TenantElectricityPanel } from "../../tenants/[id]/tenant-electricity-panel";
import { WhatsAppToggle } from "../../tenants/[id]/whatsapp-toggle";
import { PortalAccessCard } from "../../tenants/[id]/portal-access";
import { CollapsibleGroup } from "../../tenants/[id]/collapsible-group";
import { PaymentLedger } from "../../tenants/[id]/payment-ledger";
import { ChevronRight, DoorOpen, Banknote, Wrench, UserCheck, UserX, UserPlus, Receipt, Settings, AlertCircle, CheckCircle2 } from "lucide-react";

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { requireAuth } = await import("@/lib/auth");
  const { isPro } = await import("@/lib/plan");
  const user = await requireAuth();
  const pro  = isPro(user);

  const settings = await getSettings(user.id);
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  const unassignedTenants = await prisma.tenant.findMany({
    where: { userId: user.id, OR: [{ roomId: null }, { moveOutDate: { not: null } }] },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });

  const room = await prisma.room.findUnique({
    where: { id, userId: user.id },
    include: {
      tenants:          {
        where: { moveOutDate: null },
        take: 1,
        include: {
          oneTimeCharges: { orderBy: { date: "desc" } },
          payments:       { orderBy: { month: "desc" } },
        },
      },
      payments:         { select: { amountPaid: true } },
      expenses:         { orderBy: { date: "desc" }, take: 5 },
      recurringCharges: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!room) notFound();

  const currentTenant = room.tenants[0];
  const totalCollected = room.payments.reduce((s, p) => s + p.amountPaid, 0);

  // Outstanding is scoped to the *current* tenant — historical debts of past
  // tenants don't count toward what this room owes today.
  const currentTenantOutstanding = currentTenant
    ? currentTenant.payments.reduce((s, p) => s + Math.max(0, p.amountDue - p.amountPaid), 0)
      + currentTenant.oneTimeCharges.reduce((s, c) => s + Math.max(0, c.amount - c.amountPaid), 0)
    : 0;

  const rateSetting     = await prisma.setting.findUnique({ where: { userId_key: { userId: user.id, key: "electricityRate" } } });
  const electricityRate = parseFloat(rateSetting?.value ?? "0") || 0;
  const tenantRate      = currentTenant?.electricityRate ?? null;
  const effectiveRate   = (tenantRate && tenantRate > 0) ? tenantRate : electricityRate;
  const portalEnabled   = process.env.TENANT_PORTAL_ENABLED === "true";

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
        <div className="relative z-10 flex flex-wrap items-center gap-2 mt-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            currentTenant ? "bg-emerald-400/30 text-white border border-emerald-300/30" : "bg-white/20 text-white border border-white/20"
          }`}>
            {currentTenant ? <UserCheck size={12} /> : <UserX size={12} />}
            {currentTenant ? "Occupied" : "Vacant"}
          </span>
          {!currentTenant && (
            <Link
              href={`/tenants/new?roomId=${id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <UserPlus size={12} />
              Add Tenant
            </Link>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link href={`/rooms/${id}/edit`}
          className="border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          Edit Room
        </Link>
        <DeleteRoomButton roomId={id} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-emerald-400 rounded-l-2xl" />
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center mb-3">
            <Banknote size={15} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Collected</p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">{fmt(totalCollected)}</p>
          <p className="text-xs text-slate-400 mt-0.5">all-time</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 relative overflow-hidden">
          <div className={`absolute inset-y-0 left-0 w-1 ${currentTenantOutstanding > 0 ? "bg-rose-400" : "bg-emerald-400"} rounded-l-2xl`} />
          <div className={`w-8 h-8 rounded-lg ${currentTenantOutstanding > 0 ? "bg-rose-50 dark:bg-rose-500/15" : "bg-emerald-50 dark:bg-emerald-500/15"} flex items-center justify-center mb-3`}>
            {currentTenantOutstanding > 0
              ? <AlertCircle size={15} className="text-rose-500 dark:text-rose-400" />
              : <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />}
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
          <p className={`text-xl font-black mt-1 tracking-tight ${currentTenantOutstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>{fmt(currentTenantOutstanding)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{currentTenant ? "current tenant" : "no tenant"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-orange-400 rounded-l-2xl" />
          <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/15 flex items-center justify-center mb-3">
            <Wrench size={15} className="text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expenses</p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">{room.expenses.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">recorded</p>
        </div>
      </div>

      {room.description && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{room.description}</p>
        </div>
      )}

      {/* Current Tenant */}
      {currentTenant ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4 text-sm">Current Tenant</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                {currentTenant.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{currentTenant.name}</p>
                <p className="text-xs text-slate-400">{currentTenant.phone}</p>
                <p className="text-xs text-slate-400 mt-0.5">Since {formatDate(currentTenant.moveInDate)}</p>
              </div>
            </div>
            <Link href={`/tenants/${currentTenant.id}`}
              className="text-sm bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 font-semibold px-3 py-1.5 rounded-lg transition-colors">
              View Profile →
            </Link>
          </div>
        </div>
      ) : unassignedTenants.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4 text-sm">Assign Existing Tenant</h2>
          <AssignTenantPanel roomId={id} unassignedTenants={unassignedTenants} />
        </div>
      ) : null}

      {/* Charges, electricity & access — when a tenant is in the room these
          panels are the owner's day-to-day controls. When vacant, only the
          room-level recurring charges make sense. */}
      {currentTenant ? (
        <>
          <CollapsibleGroup
            title="Charges & Electricity"
            subtitle="Recurring & one-time charges, meter readings"
            icon={<Receipt size={15} />}
          >
            <TenantRecurringChargesPanel
              tenantId={currentTenant.id}
              roomId={id}
              roomCharges={room.recurringCharges.filter(c => c.tenantId === null)}
              tenantCharges={room.recurringCharges.filter(c => c.tenantId === currentTenant.id)}
              currencySymbol={settings.currencySymbol}
              moveInMonth={`${currentTenant.moveInDate.getFullYear()}-${String(currentTenant.moveInDate.getMonth() + 1).padStart(2, "0")}`}
            />
            <OneTimeChargesPanel
              tenantId={currentTenant.id}
              charges={currentTenant.oneTimeCharges.map(c => ({
                id:         c.id,
                title:      c.title,
                amount:     c.amount,
                amountPaid: c.amountPaid,
                date:       c.date.toISOString(),
                status:     c.status,
                notes:      c.notes,
              }))}
              currencySymbol={settings.currencySymbol}
              isActive={true}
            />
            <TenantElectricityPanel
              tenantId={currentTenant.id}
              defaultRate={effectiveRate}
              globalRate={electricityRate}
              tenantRate={tenantRate}
              currencySymbol={settings.currencySymbol}
              canSubmit={currentTenant.canSubmitMeterReading}
              autoAccept={currentTenant.meterReadingAutoAccept}
              portalEnabled={portalEnabled}
            />
          </CollapsibleGroup>

          <CollapsibleGroup
            title="Settings & Access"
            subtitle="Notifications, meter readings & portal link"
            icon={<Settings size={15} />}
          >
            <WhatsAppToggle tenantId={currentTenant.id} enabled={currentTenant.whatsappNotify} />
            {portalEnabled && (
              <PortalAccessCard
                tenantId={currentTenant.id}
                tenantName={currentTenant.name}
                tenantPhone={currentTenant.phone}
                portalEnabled={currentTenant.portalEnabled}
                portalToken={currentTenant.portalToken ?? null}
                isPro={pro}
              />
            )}
          </CollapsibleGroup>
        </>
      ) : (
        <RecurringChargesPanel
          roomId={id}
          charges={room.recurringCharges.filter(c => c.tenantId === null)}
          monthlyRent={room.monthlyRent}
          currencySymbol={settings.currencySymbol}
        />
      )}

      {/* Payment Ledger — full month-by-month view for the current tenant. */}
      {currentTenant && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Payment Ledger</h2>
            <p className="text-xs text-slate-400 mt-0.5">{currentTenant.payments.length} months recorded</p>
          </div>
          <PaymentLedger
            payments={currentTenant.payments.map(p => ({
              id:         p.id,
              month:      p.month,
              amountDue:  p.amountDue,
              amountPaid: p.amountPaid,
              paidDate:   p.paidDate?.toISOString() ?? null,
              method:     p.method,
              status:     p.status,
              notes:      p.notes,
              breakdown: {
                baseRent: room.monthlyRent,
                charges:  room.recurringCharges
                  .filter(c => (c.tenantId === null || c.tenantId === currentTenant.id)
                    && (!c.effectiveFrom || c.effectiveFrom <= p.month)
                    && (!c.effectiveTo   || p.month <= c.effectiveTo))
                  .map(c => ({ title: c.title, amount: c.amount })),
              },
            }))}
            currencySymbol={settings.currencySymbol}
            isPro={pro}
            tenantPhone={currentTenant.phone}
            whatsappNotify={currentTenant.whatsappNotify}
            moveInDay={currentTenant.moveInDate.getDate()}
          />
        </div>
      )}
    </div>
  );
}
