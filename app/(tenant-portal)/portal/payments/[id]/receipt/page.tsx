export const dynamic = "force-dynamic";

import { requireTenantPage } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { PortalShell } from "../../../_components/portal-shell";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default async function PortalReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }   = await params;
  const session  = await requireTenantPage();
  const tenant   = session.tenant;
  const settings = await getSettings();
  const fmt      = (n: number) => formatCurrency(n, settings.currencySymbol);

  // Enforce: payment must belong to this tenant — NEVER trust the URL id alone
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { tenant: true, room: true },
  });

  if (!payment || payment.tenantId !== tenant.id || payment.amountPaid === 0) {
    notFound();
  }

  const propertyName = (await prisma.setting.findUnique({ where: { key: "propertyName" } }))?.value ?? "Property";
  const ownerName    = (await prisma.setting.findUnique({ where: { key: "ownerName" } }))?.value ?? "Landlord";
  const ownerPhone   = (await prisma.setting.findUnique({ where: { key: "ownerPhone" } }))?.value;

  return (
    <PortalShell tenantName={tenant.name} roomName={tenant.room?.name ?? null}>
      <div className="space-y-4">
        <Link href="/portal/payments" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft size={14} />
          Back to payments
        </Link>

        {/* Receipt card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-teal-600 px-6 py-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={18} className="text-teal-200" />
              <span className="text-xs font-bold text-teal-200 uppercase tracking-wider">Payment Receipt</span>
            </div>
            <p className="text-2xl font-black">{fmt(payment.amountPaid)}</p>
            <p className="text-teal-200 text-sm mt-0.5">{formatMonth(payment.month)}</p>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Property */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Property</span>
                <span className="font-medium text-slate-800">{propertyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Landlord</span>
                <span className="font-medium text-slate-800">{ownerName}</span>
              </div>
              {ownerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Contact</span>
                  <span className="font-medium text-slate-800">{ownerPhone}</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* Tenant */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Tenant</span>
                <span className="font-medium text-slate-800">{payment.tenant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Room</span>
                <span className="font-medium text-slate-800">{payment.room.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Period</span>
                <span className="font-medium text-slate-800">{formatMonth(payment.month)}</span>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Payment details */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Due</span>
                <span className="font-medium text-slate-800">{fmt(payment.amountDue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Paid</span>
                <span className="font-bold text-emerald-700">{fmt(payment.amountPaid)}</span>
              </div>
              {payment.amountDue - payment.amountPaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Balance</span>
                  <span className="font-bold text-rose-600">{fmt(payment.amountDue - payment.amountPaid)}</span>
                </div>
              )}
              {payment.paidDate && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Paid On</span>
                  <span className="font-medium text-slate-800">{formatDate(payment.paidDate)}</span>
                </div>
              )}
              {payment.method && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Method</span>
                  <span className="font-medium text-slate-800">{payment.method}</span>
                </div>
              )}
            </div>

            {payment.notes && (
              <>
                <div className="border-t border-slate-100" />
                <p className="text-xs text-slate-400">{payment.notes}</p>
              </>
            )}

            {/* Footer */}
            <div className="bg-slate-50 rounded-xl px-4 py-3 text-center border border-slate-100">
              <p className="text-xs text-slate-500">
                This is a digital receipt. Thank you for your payment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
