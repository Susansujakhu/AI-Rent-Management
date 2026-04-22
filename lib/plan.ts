import type { AuthUser } from "./auth";
import { PLANS } from "./pricing";

// ── Constants ─────────────────────────────────────────────────────────────────

export const FREE_TRIAL_DAYS = 90; // 3-month full-access trial

// ── Plan status ───────────────────────────────────────────────────────────────

export type PlanStatus = "trial" | "basic" | "starter" | "pro" | "expired";

export function getPlanStatus(user: AuthUser): PlanStatus {
  const now = new Date();

  // Active paid plan
  if (user.plan === "pro" || user.plan === "starter" || user.plan === "basic") {
    if (!user.planExpiresAt || user.planExpiresAt > now) {
      return user.plan as PlanStatus;
    }
  }

  // Free trial (90 days from signup)
  const trialEnd = new Date(user.createdAt);
  trialEnd.setDate(trialEnd.getDate() + FREE_TRIAL_DAYS);
  if (trialEnd > now) return "trial";

  return "expired";
}

// Days of trial remaining (0 if on paid plan or expired)
export function trialDaysLeft(user: AuthUser): number {
  if (user.plan === "pro" || user.plan === "starter" || user.plan === "basic") return 0;
  const trialEnd = new Date(user.createdAt);
  trialEnd.setDate(trialEnd.getDate() + FREE_TRIAL_DAYS);
  return Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000));
}

// ── Access helpers ────────────────────────────────────────────────────────────

// Any active access (trial or paid)
export function hasAccess(user: AuthUser): boolean {
  return getPlanStatus(user) !== "expired";
}

// Unlimited access (trial or pro)
export function isPro(user: AuthUser): boolean {
  const s = getPlanStatus(user);
  return s === "pro" || s === "trial";
}

// Room limit for current plan (-1 = unlimited)
export function roomLimit(user: AuthUser): number {
  const s = getPlanStatus(user);
  if (s === "trial" || s === "pro") return -1; // unlimited
  if (s === "basic" || s === "starter") return PLANS[s].roomLimit;
  return 0; // expired
}

// Can add another room given current count
export function canAddRoom(user: AuthUser, currentCount: number): boolean {
  const limit = roomLimit(user);
  if (limit === -1) return true;
  return currentCount < limit;
}

// Standard 402 — frontend checks `upgrade: true` to show CTA
export function planLimitResponse(message: string): Response {
  return Response.json({ error: message, upgrade: true }, { status: 402 });
}

// 403 — trial expired
export function trialExpiredResponse(): Response {
  return Response.json(
    { error: "Your free trial has expired. Please upgrade to continue.", expired: true },
    { status: 403 }
  );
}
