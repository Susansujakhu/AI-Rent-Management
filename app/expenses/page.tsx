export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, EXPENSE_CATEGORIES } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-1">{expenses.length} expense{expenses.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/expenses/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Expense
        </Link>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/expenses"
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !category
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          All
        </Link>
        {EXPENSE_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/expenses?category=${cat}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              category === cat
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {cat}
          </Link>
        ))}
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-xl border border-gray-200">
        {expenses.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No expenses found.{" "}
            <Link href="/expenses/new" className="text-blue-600 underline">
              Add one
            </Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-orange-600">
                        {expense.category.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{expense.title}</p>
                      <p className="text-xs text-gray-500">
                        {expense.category} · {expense.room ? expense.room.name : "Common Area"} · {formatDate(expense.date)}
                      </p>
                      {expense.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{expense.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{fmt(expense.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 rounded-b-xl">
              <span className="text-sm font-medium text-gray-700">Total</span>
              <span className="text-sm font-bold text-gray-900">{fmt(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
