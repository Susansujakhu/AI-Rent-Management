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
  // month is "2024-12" format — rent period starts this month, ends next
  // e.g. "2024-12" → "Dec/Jan 2025"  |  "2026-04" → "Apr/May 2026"
  const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const yr       = parseInt(month.split("-")[0]);
  const idx      = parseInt(month.split("-")[1]) - 1;  // 0-based current month
  const nextIdx  = (idx + 1) % 12;                     // wraps Dec → Jan
  const nextYear = idx === 11 ? yr + 1 : yr;            // bump year on Dec→Jan
  return `${MONTHS[idx]}/${MONTHS[nextIdx]} ${nextYear}`;
}

// Returns the exact rental cycle period based on move-in day.
// e.g. month="2026-04", moveInDay=14 → "Apr 14 – May 14, 2026"
//      month="2026-12", moveInDay=20 → "Dec 20 – Jan 20, 2027"
// Falls back to formatMonth when moveInDay is 1 or not provided.
export function formatRentalPeriod(month: string, moveInDay?: number): string {
  if (!moveInDay || moveInDay <= 1) return formatMonth(month);
  const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const yr       = parseInt(month.split("-")[0]);
  const idx      = parseInt(month.split("-")[1]) - 1;
  const nextIdx  = (idx + 1) % 12;
  const nextYear = idx === 11 ? yr + 1 : yr;
  return `${MONTHS[idx]} ${moveInDay} – ${MONTHS[nextIdx]} ${moveInDay}, ${nextYear}`;
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

export const PAYMENT_METHODS = ["CASH", "E-WALLET", "BANK", "CHEQUE", "DEPOSIT", "ADVANCE"] as const;
