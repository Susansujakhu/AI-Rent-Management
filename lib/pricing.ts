// ── Pricing & payment details ─────────────────────────────────────────────────
// Update this file when pricing or payment accounts change.

export const PLANS = {
  basic: {
    id:        "basic",
    name:      "Basic",
    desc:      "Up to 3 rooms",
    roomLimit: 3,
    monthly:   { amount: 199,  label: "Rs. 199 / month" },
    yearly:    { amount: 1999, label: "Rs. 1,999 / year",      savings: "Save 2 months" },
    lifetime:  { amount: 3999, label: "Rs. 3,999 one-time",    savings: "Pay once, use forever" },
    color:     "indigo",
    highlight: false,
  },
  starter: {
    id:        "starter",
    name:      "Starter",
    desc:      "Up to 5 rooms",
    roomLimit: 5,
    monthly:   { amount: 299,  label: "Rs. 299 / month" },
    yearly:    { amount: 2999, label: "Rs. 2,999 / year",      savings: "Save 2 months" },
    lifetime:  { amount: 5999, label: "Rs. 5,999 one-time",    savings: "Pay once, use forever" },
    color:     "violet",
    highlight: true,   // "most popular" badge
  },
  pro: {
    id:        "pro",
    name:      "Pro",
    desc:      "Unlimited rooms",
    roomLimit: Infinity,
    monthly:   { amount: 499,  label: "Rs. 499 / month" },
    yearly:    { amount: 4999, label: "Rs. 4,999 / year",      savings: "Save 2 months" },
    lifetime:  { amount: 9999, label: "Rs. 9,999 one-time",    savings: "Pay once, use forever" },
    color:     "amber",
    highlight: false,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const PAYMENT_METHODS = [
  {
    name:   "eSewa",
    id:     "esewa",
    number: "9866297369",
    holder: "Susan Sujakhu",
    qr:     "/qr-esewa.jpg",
    color:  "#60BB46",
  },
  {
    name:   "Khalti",
    id:     "khalti",
    number: "9866297369",
    holder: "Susan Sujakhu",
    qr:     "/qr-khalti.jpg",
    color:  "#5C2D91",
  },
  {
    name:   "Bank Transfer",
    id:     "bank",
    number: null,
    holder: null,
    qr:     null,
    note:   "WhatsApp us for bank details",
    color:  "#3B82F6",
  },
] as const;

export const CONTACT_WHATSAPP = "9866297369";
