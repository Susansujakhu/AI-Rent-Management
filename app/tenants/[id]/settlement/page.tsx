export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { formatCurrency, formatDate, formatRentalPeriod } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { PrintButton } from "./print-button";

type DetailLine = { type: string; label: string; month?: string; due: number; paid: number; outstanding: number };
type Detail = {
  finalMonth?: { month: string; baseAmount: number; proratedDue: number; daysOccupied: number; daysInPeriod: number } | null;
  lines?: DetailLine[];
  deductions?: Array<{ title: string; amount: number }>;
};

export default async function SettlementStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  const tenant = await prisma.tenant.findUnique({
    where: { id, userId: user.id },
    include: { room: true, settlement: true },
  });
  if (!tenant?.settlement) notFound();
  const s = tenant.settlement;

  const settings = await getSettings(user.id);
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);
  const detail: Detail = s.detail ? JSON.parse(s.detail) : {};
  const moveInDay = tenant.moveInDate.getDate();

  const propertyName = (await prisma.setting.findUnique({ where: { userId_key: { userId: user.id, key: "propertyName" } } }))?.value ?? "Property";
  const ownerName    = (await prisma.setting.findUnique({ where: { userId_key: { userId: user.id, key: "ownerName" } } }))?.value ?? "Landlord";

  return (
    <div className="space-y-4 animate-fade-up max-w-2xl mx-auto">
      {/* Breadcrumb + print (hidden when printing) */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <Link href="/tenants" className="hover:text-slate-600 transition-colors">Tenants</Link>
          <ChevronRight size={14} />
          <Link href={`/tenants/${id}`} className="hover:text-slate-600 transition-colors">{tenant.name}</Link>
          <ChevronRight size={14} />
          <span className="text-slate-600 font-medium">Settlement</span>
        </div>
        <PrintButton />
      </div>

      {/* Statement card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden print:shadow-none print:border-slate-300">
        {/* Header */}
        <div className="bg-slate-800 dark:bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Move-out Settlement Statement</span>
          </div>
          <p className="text-2xl font-black">{tenant.name}</p>
          <p className="text-slate-400 text-sm mt-0.5">
            {tenant.room?.name ? `${tenant.room.name} · ` : ""}Moved out {formatDate(s.moveOutDate)}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm">
          {/* Parties */}
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Property</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{propertyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Landlord</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{ownerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tenancy</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {formatDate(tenant.moveInDate)} — {formatDate(s.moveOutDate)}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Final period proration */}
          {detail.finalMonth && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Final Period</p>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {formatRentalPeriod(detail.finalMonth.month, moveInDay)} — {detail.finalMonth.daysOccupied} of {detail.finalMonth.daysInPeriod} days
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {fmt(detail.finalMonth.proratedDue)}
                  <span className="text-xs text-slate-400"> (of {fmt(detail.finalMonth.baseAmount)})</span>
                </span>
              </div>
            </div>
          )}

          {/* Dues breakdown */}
          {(detail.lines?.length ?? 0) > 0 && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-800" />
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outstanding at Move-out</p>
                {detail.lines!.map((l, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      {l.type === "rent" && l.month ? `Rent — ${formatRentalPeriod(l.month, moveInDay)}` : l.label}
                      {l.type === "deduction" && <span className="text-xs"> (deduction)</span>}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{fmt(l.outstanding)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Settlement math */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total dues</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{fmt(s.totalDue)}</span>
            </div>
            {s.creditApplied > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Advance credit applied</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">−{fmt(s.creditApplied)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Security deposit held</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{fmt(s.depositHeld)}</span>
            </div>
            {s.depositApplied > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Deposit applied to dues</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">−{fmt(s.depositApplied)}</span>
              </div>
            )}
          </div>

          {/* Result */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 space-y-1 print:border print:border-slate-300">
            {s.refundDue > 0 && (
              <div className="flex justify-between text-base">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Refund due to tenant</span>
                <span className="font-black text-emerald-700 dark:text-emerald-400">{fmt(s.refundDue)}</span>
              </div>
            )}
            {s.balanceDue > 0 && (
              <div className="flex justify-between text-base">
                <span className="font-bold text-rose-600">Balance due from tenant</span>
                <span className="font-black text-rose-600">{fmt(s.balanceDue)}</span>
              </div>
            )}
            {s.refundDue === 0 && s.balanceDue === 0 && (
              <p className="font-bold text-emerald-700 dark:text-emerald-400 text-center">Fully settled — nothing due either way</p>
            )}
          </div>

          {s.notes && (
            <p className="text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">{s.notes}</p>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl px-4 py-3 text-center border border-slate-100 dark:border-slate-800 print:border-slate-300">
            <p className="text-xs text-slate-500">
              Settlement recorded on {formatDate(s.createdAt)}. This statement summarizes the final account between landlord and tenant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
