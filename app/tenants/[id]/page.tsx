export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { MoveOutButton } from "./move-out-button";
import { WhatsAppToggle } from "./whatsapp-toggle";
import { VoidPaymentButton } from "./void-payment-button";
import { SendReminderButton } from "./send-reminder-button";
import { TenantRecurringChargesPanel } from "./tenant-recurring-charges";
import { PortalAccessCard } from "./portal-access";
import { getSettings } from "@/lib/settings";
import { ChevronRight, Phone, Mail, Home, Calendar, Shield, TrendingUp, AlertCircle, Sparkles, MessageCircle } from "lucide-react";

function monthString(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthRange(start: string, end: string) {
  const months: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(monthString(y, m));
    if (++m > 12) { m = 1; y++; }
  }
  return months;
}

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

const AVATAR_COLORS = [
  "from-violet-400 to-violet-600",
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-orange-400 to-orange-600",
  "from-rose-400 to-rose-600",
  "from-indigo-400 to-indigo-600",
];

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tenantBase = await prisma.tenant.findUnique({
    where: { id },
    include: { room: { include: { recurringCharges: true } }, oneTimeCharges: { orderBy: { date: "desc" } } },
  });

  if (!tenantBase) notFound();

  if (!tenantBase.moveOutDate && tenantBase.room && tenantBase.roomId) {
    const today        = new Date();
    const currentMonth = monthString(today.getFullYear(), today.getMonth() + 1);
    const moveInDate   = tenantBase.moveInDate;
    const moveInMonth  = monthString(moveInDate.getFullYear(), moveInDate.getMonth() + 1);
    for (const m of monthRange(moveInMonth, currentMonth)) {
      const chargesForMonth = tenantBase.room.recurringCharges
        .filter(c => (c.tenantId === null || c.tenantId === tenantBase.id) && (!c.effectiveFrom || c.effectiveFrom <= m))
        .reduce((s, c) => s + c.amount, 0);
      const baseAmount = tenantBase.room.monthlyRent + chargesForMonth;

      let amountDue = baseAmount;
      if (m === moveInMonth && moveInDate.getDate() > 1) {
        const daysInMonth  = new Date(moveInDate.getFullYear(), moveInDate.getMonth() + 1, 0).getDate();
        const daysOccupied = daysInMonth - moveInDate.getDate() + 1;
        amountDue = Math.round((daysOccupied / daysInMonth) * baseAmount);
      }

      const existing = await prisma.payment.findUnique({
        where: { tenantId_month: { tenantId: tenantBase.id, month: m } },
        select: { id: true, status: true },
      });

      if (!existing) {
        await prisma.payment.create({
          data: { tenantId: tenantBase.id, roomId: tenantBase.roomId, month: m, amountDue, amountPaid: 0, status: m < currentMonth ? "OVERDUE" : "PENDING" },
        });
      } else if (existing.status !== "PAID") {
        await prisma.payment.update({ where: { id: existing.id }, data: { amountDue } });
      }
    }
  }

  if (tenantBase.creditBalance > 0) {
    const unpaid = await prisma.payment.findMany({
      where:   { tenantId: tenantBase.id, status: { not: "PAID" } },
      orderBy: { month: "asc" },
    });
    let credit = tenantBase.creditBalance;
    for (const p of unpaid) {
      if (credit <= 0) break;
      const balance = p.amountDue - p.amountPaid;
      if (balance <= 0) continue;
      const apply   = Math.min(credit, balance);
      credit       -= apply;
      const newPaid = p.amountPaid + apply;
      await prisma.payment.update({
        where: { id: p.id },
        data:  { amountPaid: newPaid, status: newPaid >= p.amountDue ? "PAID" : "PARTIAL", method: "ADVANCE", notes: "Applied from advance credit" },
      });
    }
    if (credit !== tenantBase.creditBalance) {
      await prisma.tenant.update({ where: { id: tenantBase.id }, data: { creditBalance: credit } });
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      room: { include: { recurringCharges: { orderBy: { createdAt: "asc" } } } },
      payments: { orderBy: { month: "desc" }, include: { room: true } },
      oneTimeCharges: { orderBy: { date: "desc" } },
    },
  });

  if (!tenant) notFound();

  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  const isActive         = !tenant.moveOutDate;
  const totalCollected   = tenant.payments.reduce((sum, p) => sum + p.amountPaid, 0) + tenant.oneTimeCharges.reduce((sum, c) => sum + c.amountPaid, 0);
  const totalOutstanding = tenant.payments.reduce((sum, p) => sum + Math.max(0, p.amountDue - p.amountPaid), 0) + tenant.oneTimeCharges.reduce((sum, c) => sum + Math.max(0, c.amount - c.amountPaid), 0);
  const overdueCount = tenant.payments.filter(p => p.status === "OVERDUE").length;

  const avatarColor = AVATAR_COLORS[tenant.name.charCodeAt(0) % AVATAR_COLORS.length];
  const initials = tenant.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  // Move-in anniversary
  const now = new Date();
  const yearsWithUs = now.getFullYear() - tenant.moveInDate.getFullYear();

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/tenants" className="hover:text-slate-600 transition-colors">Tenants</Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 font-medium">{tenant.name}</span>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className={`bg-gradient-to-r ${avatarColor} h-20 relative`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute bottom-0 right-4 translate-y-1/2">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor} shadow-lg border-4 border-white flex items-center justify-center text-white text-xl font-black`}>
              {initials}
            </div>
          </div>
        </div>
        <div className="px-5 pt-10 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                  isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
                }`}>
                  {isActive ? "Active" : "Past Tenant"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2.5">
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Phone size={13} className="text-slate-400" />
                  {tenant.phone}
                </span>
                {tenant.email && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Mail size={13} className="text-slate-400" />
                    {tenant.email}
                  </span>
                )}
                {tenant.room && (
                  <Link href={`/rooms/${tenant.room.id}`} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    <Home size={13} />
                    {tenant.room.name}
                  </Link>
                )}
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Calendar size={13} className="text-slate-400" />
                  Since {formatDate(tenant.moveInDate)}
                  {yearsWithUs >= 1 && (
                    <span className="flex items-center gap-0.5 text-violet-600 font-semibold text-xs">
                      <Sparkles size={11} />
                      {yearsWithUs}yr
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href={`/tenants/${id}/edit`}
                className="border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
                Edit
              </Link>
              {isActive && <MoveOutButton tenantId={id} moveInDate={tenant.moveInDate.toISOString()} />}
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-sm shadow-emerald-200 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mb-3">
            <TrendingUp size={15} className="text-white" />
          </div>
          <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Total Collected</p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">{fmt(totalCollected)}</p>
        </div>

        <div className={`rounded-2xl shadow-sm p-5 relative overflow-hidden ${
          totalOutstanding > 0
            ? "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-200"
            : "bg-white border border-slate-100"
        }`}>
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${totalOutstanding > 0 ? "bg-white/20" : "bg-rose-50"}`}>
            <AlertCircle size={15} className={totalOutstanding > 0 ? "text-white" : "text-rose-500"} />
          </div>
          <p className={`text-xs font-bold uppercase tracking-wider ${totalOutstanding > 0 ? "text-rose-100" : "text-slate-400"}`}>Outstanding</p>
          <p className={`text-2xl font-black mt-1 tracking-tight ${totalOutstanding > 0 ? "text-white" : "text-rose-600"}`}>{fmt(totalOutstanding)}</p>
          {overdueCount > 0 && (
            <p className="text-xs text-rose-100 mt-0.5">{overdueCount} overdue month{overdueCount !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>

      {/* Advance credit */}
      {tenant.creditBalance > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Shield size={15} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900">Advance Credit</p>
              <p className="text-xs text-indigo-500">Will auto-apply to next payment</p>
            </div>
          </div>
          <p className="text-xl font-black text-indigo-700">{fmt(tenant.creditBalance)}</p>
        </div>
      )}

      {/* WhatsApp notification toggle */}
      <WhatsAppToggle tenantId={id} enabled={tenant.whatsappNotify} />

      {/* Tenant Portal Access */}
      {process.env.TENANT_PORTAL_ENABLED === "true" && (
        <PortalAccessCard
          tenantId={id}
          tenantName={tenant.name}
          tenantPhone={tenant.phone}
          portalEnabled={tenant.portalEnabled}
          portalToken={tenant.portalToken ?? null}
        />
      )}

      {/* Contact info card */}
      {(tenant.deposit > 0 || tenant.notes) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Details</h2>
          <div className="space-y-2.5 text-sm divide-y divide-slate-50">
            {tenant.deposit > 0 && (
              <div className="flex justify-between pt-2 first:pt-0">
                <span className="text-slate-400 font-medium">Security Deposit</span>
                <span className="font-bold text-slate-800">{fmt(tenant.deposit)}</span>
              </div>
            )}
            {tenant.moveOutDate && (
              <div className="flex justify-between pt-2 first:pt-0">
                <span className="text-slate-400 font-medium">Move-out Date</span>
                <span className="font-semibold text-slate-800">{formatDate(tenant.moveOutDate)}</span>
              </div>
            )}
            {tenant.notes && (
              <div className="pt-2 first:pt-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes</p>
                <p className="text-sm text-slate-600">{tenant.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recurring Charges */}
      {isActive && tenant.room && (
        <TenantRecurringChargesPanel
          tenantId={id}
          roomId={tenant.room.id}
          roomCharges={tenant.room.recurringCharges.filter(c => c.tenantId === null)}
          tenantCharges={tenant.room.recurringCharges.filter(c => c.tenantId === id)}
          currencySymbol={settings.currencySymbol}
          moveInMonth={`${tenant.moveInDate.getFullYear()}-${String(tenant.moveInDate.getMonth() + 1).padStart(2, "0")}`}
        />
      )}

      {/* Payment Ledger */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Payment Ledger</h2>
            <p className="text-xs text-slate-400 mt-0.5">{tenant.payments.length} months recorded</p>
          </div>
        </div>
        {tenant.payments.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No payment records yet.</div>
        ) : (
          <>
            {/* Mobile view */}
            <div className="divide-y divide-slate-50 sm:hidden">
              {tenant.payments.map(p => (
                <div key={p.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-800 text-sm">{formatMonth(p.month)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{fmt(p.amountPaid)} / {fmt(p.amountDue)}</span>
                    <div className="flex items-center gap-2">
                      {p.status !== "PAID" && (
                        <>
                          <Link href={`/payments/${p.id}/pay`}
                            className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                            Pay
                          </Link>
                          <SendReminderButton
                            paymentId={p.id}
                            paymentStatus={p.status}
                            hasPhone={!!tenant.phone}
                            whatsappNotify={tenant.whatsappNotify}
                          />
                        </>
                      )}
                      {p.amountPaid > 0 && (
                        <Link href={`/payments/${p.id}/receipt`}
                          className="text-xs text-slate-400 hover:text-indigo-600 transition-colors font-medium">
                          Receipt
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-slate-50/40">
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Month</th>
                    <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Due</th>
                    <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid</th>
                    <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid On</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Method</th>
                    <th className="px-4 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tenant.payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{formatMonth(p.month)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-500">{fmt(p.amountDue)}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900">{fmt(p.amountPaid)}</td>
                      <td className="px-4 py-3.5 text-center"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs tabular-nums">{p.paidDate ? formatDate(p.paidDate) : "—"}</td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs">{p.method ?? "—"}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {p.status !== "PAID" && (
                            <>
                              <Link href={`/payments/${p.id}/pay`}
                                className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                                Pay
                              </Link>
                              <SendReminderButton
                                paymentId={p.id}
                                paymentStatus={p.status}
                                hasPhone={!!tenant.phone}
                                whatsappNotify={tenant.whatsappNotify}
                              />
                            </>
                          )}
                          {p.amountPaid > 0 && (
                            <>
                              <Link href={`/payments/${p.id}/receipt`}
                                className="text-xs text-slate-400 hover:text-indigo-600 transition-colors font-medium">
                                Receipt
                              </Link>
                              <VoidPaymentButton paymentId={p.id} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* One-time Charges */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">One-time Charges</h2>
            <p className="text-xs text-slate-400 mt-0.5">{tenant.oneTimeCharges.length} charge{tenant.oneTimeCharges.length !== 1 ? "s" : ""}</p>
          </div>
          {isActive && (
            <Link href={`/tenants/${id}/one-time-charge/new`}
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors font-semibold">
              + Add Charge
            </Link>
          )}
        </div>
        {tenant.oneTimeCharges.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No one-time charges.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-slate-50/40">
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid</th>
                  <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tenant.oneTimeCharges.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-800">{c.title}</span>
                      {c.notes && <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs tabular-nums">{formatDate(c.date)}</td>
                    <td className="px-4 py-3.5 text-right text-slate-500">{fmt(c.amount)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900">{fmt(c.amountPaid)}</td>
                    <td className="px-4 py-3.5 text-center"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3.5">
                      {c.status !== "PAID" && (
                        <Link href={`/tenants/${id}/one-time-charge/${c.id}/pay`}
                          className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors font-medium opacity-0 group-hover:opacity-100">
                          Pay
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
