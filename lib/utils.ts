import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, symbol = "रू"): string {
  return `${symbol}${new Intl.NumberFormat("en", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatMonth(month: string): string {
  // month is "2024-01" format
  const [year, m] = month.split("-");
  return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthsList(count = 12): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export const EXPENSE_CATEGORIES = [
  "PLUMBING",
  "ELECTRICAL",
  "PAINTING",
  "CLEANING",
  "APPLIANCE",
  "OTHER",
] as const;

export const PAYMENT_METHODS = ["CASH", "UPI", "BANK", "CHEQUE", "DEPOSIT", "ADVANCE"] as const;
