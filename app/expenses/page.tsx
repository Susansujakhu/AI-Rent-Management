export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, EXPENSE_CATEGORIES } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { Plus, Receipt } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Electricity:  "bg-yellow-50 text-yellow-600",
  Water:        "bg-blue-50 text-blue-600",
  Internet:     "bg-indigo-50 text-indigo-600",
  Plumbing:     "bg-cyan-50 text-cyan-600",
  Electrical:   "bg-amber-50 text-amber-600",
  Painting:     "bg-pink-50 text-pink-600",
  Cleaning:     "bg-teal-50 text-teal-600",
  Security:     "bg-slate-100 text-slate-600",
  Maintenance:  "bg-orange-50 text-orange-600",
  Other:        "bg-slate-100 text-slate-500",
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-slate-100 text-slate-500";
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const settings = await getSettings();
  const fmt = (n: number) => formatCurrency(n, settings.currencySymbol);

  const expenses = await prisma.expense.findMany({
    where: category ? { category } : undefined,
    include: { room: true },
    orderBy: { date: "desc" },
  });

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">{expenses.length} expense{expenses.length !== 1 ? "s" : ""}{category ? ` in ${category}` : ""}</p>
        </div>
        <Link
          href="/expenses/new"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
        >
          <Plus size={15} />
          Add Expense
        </Link>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/expenses"
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            !category
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          All
        </Link>
        {EXPENSE_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/expenses?category=${cat}`}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              category === cat
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {cat}
          </Link>
        ))}
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {expenses.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Receipt size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm">No expenses found.{" "}
              <Link href="/expenses/new" className="text-indigo-600 underline">Add one</Link>
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${categoryColor(expense.category)}`}>
                      {expense.category.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{expense.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-medium">{expense.category}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        {expense.room ? expense.room.name : "Common Area"}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {formatDate(expense.date)}
                      </p>
                      {expense.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{expense.description}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{fmt(expense.amount)}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3.5 border-t border-slate-100 flex justify-between items-center bg-slate-50/60">
              <span className="text-sm font-medium text-slate-600">Total{category ? ` (${category})` : ""}</span>
              <span className="text-base font-bold text-slate-900">{fmt(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
