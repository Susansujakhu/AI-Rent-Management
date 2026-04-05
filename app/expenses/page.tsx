export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, EXPENSE_CATEGORIES } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import {
  Plus,
  Receipt,
  Zap,
  Droplets,
  Wifi,
  Wrench,
  PaintBucket,
  Sparkles,
  ShieldCheck,
  Settings2,
  Package,
  MoreHorizontal,
  TrendingDown,
} from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { Suspense } from "react";

// Keys match EXPENSE_CATEGORIES (uppercase)
const CATEGORY_CONFIG: Record<
  string,
  { pill: string; icon: string; bg: string; text: string; border: string }
> = {
  PLUMBING:   { pill: "bg-cyan-100 text-cyan-700 border border-cyan-200",    icon: "bg-cyan-100 text-cyan-600",    bg: "bg-cyan-50",    text: "text-cyan-700",   border: "border-cyan-200" },
  ELECTRICAL: { pill: "bg-amber-100 text-amber-700 border border-amber-200", icon: "bg-amber-100 text-amber-600",  bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200" },
  PAINTING:   { pill: "bg-pink-100 text-pink-700 border border-pink-200",    icon: "bg-pink-100 text-pink-600",    bg: "bg-pink-50",    text: "text-pink-700",   border: "border-pink-200" },
  CLEANING:   { pill: "bg-teal-100 text-teal-700 border border-teal-200",    icon: "bg-teal-100 text-teal-600",    bg: "bg-teal-50",    text: "text-teal-700",   border: "border-teal-200" },
  APPLIANCE:  { pill: "bg-indigo-100 text-indigo-700 border border-indigo-200", icon: "bg-indigo-100 text-indigo-600", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  OTHER:      { pill: "bg-slate-100 text-slate-600 border border-slate-200", icon: "bg-slate-100 text-slate-500",  bg: "bg-slate-50",   text: "text-slate-600",  border: "border-slate-200" },
};

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING:   "Plumbing",
  ELECTRICAL: "Electrical",
  PAINTING:   "Painting",
  CLEANING:   "Cleaning",
  APPLIANCE:  "Appliance",
  OTHER:      "Other",
};

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const props = { size: 16, className };
  switch (category) {
    case "PLUMBING":   return <Droplets {...props} />;
    case "ELECTRICAL": return <Zap {...props} />;
    case "PAINTING":   return <PaintBucket {...props} />;
    case "CLEANING":   return <Sparkles {...props} />;
    case "APPLIANCE":  return <Settings2 {...props} />;
    default:           return <MoreHorizontal {...props} />;
  }
}

function categoryConfig(cat: string) {
  return CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG["OTHER"];
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string }>;
}) {
  const { category, search } = await searchParams;
  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  const expenses = await prisma.expense.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
        ],
      } : {}),
    },
    include: { room: true },
    orderBy: { date: "desc" },
  });

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
            {category ? ` · ${CATEGORY_LABELS[category] ?? category}` : ""}
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-200 shrink-0"
        >
          <Plus size={15} />
          Add Expense
        </Link>
      </div>

      {/* Search */}
      <Suspense>
        <SearchInput placeholder="Search expenses…" />
      </Suspense>

      {/* Category Filter Pills — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        <Link
          href="/expenses"
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
            !category
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          All
        </Link>
        {EXPENSE_CATEGORIES.map((cat) => {
          const cfg = categoryConfig(cat);
          const isActive = category === cat;
          return (
            <Link
              key={cat}
              href={`/expenses?category=${cat}`}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                isActive ? `${cfg.bg} ${cfg.text} ${cfg.border} border shadow-sm` : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <CategoryIcon category={cat} className={isActive ? cfg.text : "text-slate-400"} />
              {CATEGORY_LABELS[cat]}
            </Link>
          );
        })}
      </div>

      {/* Summary card — shown when there are expenses */}
      {expenses.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 flex items-center justify-between text-white shadow-lg shadow-slate-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <TrendingDown size={18} className="text-white/80" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">
                Total{category ? ` · ${CATEGORY_LABELS[category] ?? category}` : ""}
              </p>
              <p className="text-2xl font-bold tracking-tight">{fmt(total)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{expenses.length} expense{expenses.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Expenses List */}
      {expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
            <Receipt size={24} className="text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold text-sm">No expenses found</p>
          <p className="text-slate-400 text-xs mt-1 mb-4">
            {search || category
              ? "Try adjusting your search or filter"
              : "Start tracking your property expenses"}
          </p>
          {!search && !category && (
            <Link
              href="/expenses/new"
              className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Plus size={13} />
              Add Expense
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: card list */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hidden sm:block">
            <div className="divide-y divide-slate-50">
              {expenses.map((expense) => {
                const cfg = categoryConfig(expense.category);
                return (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.icon}`}>
                        <CategoryIcon category={expense.category} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{expense.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.pill}`}>
                            <CategoryIcon category={expense.category} className={`${cfg.text} !w-3 !h-3`} />
                            {CATEGORY_LABELS[expense.category] ?? expense.category}
                          </span>
                          <span className="text-xs text-slate-400">
                            {expense.room ? expense.room.name : "Common Area"}
                          </span>
                          <span className="text-slate-200 text-xs">·</span>
                          <span className="text-xs text-slate-400">{formatDate(expense.date)}</span>
                        </div>
                        {expense.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{expense.description}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-base font-bold text-slate-800 shrink-0 ml-4">{fmt(expense.amount)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile: individual cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {expenses.map((expense) => {
              const cfg = categoryConfig(expense.category);
              return (
                <div
                  key={expense.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.icon}`}>
                        <CategoryIcon category={expense.category} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 leading-tight">{expense.title}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${cfg.pill}`}>
                          {CATEGORY_LABELS[expense.category] ?? expense.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-base font-bold text-slate-800 shrink-0">{fmt(expense.amount)}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50 text-xs text-slate-400">
                    <span>{expense.room ? expense.room.name : "Common Area"}</span>
                    <span className="text-slate-200">·</span>
                    <span>{formatDate(expense.date)}</span>
                  </div>
                  {expense.description && (
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{expense.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
