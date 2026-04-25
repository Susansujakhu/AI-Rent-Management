import React from "react";
import Link from "next/link";
import { Playfair_Display, DM_Mono } from "next/font/google";
import {
  Check, ArrowRight, MessageCircle, FileText, BarChart3,
  Users, DoorOpen, CreditCard, Zap, Star, Quote, Building2,
} from "lucide-react";
import { LandingNavbar } from "./_components/landing-navbar";
import { LogoMark } from "@/components/brand/logo-mark";

const serif = Playfair_Display({ weight: ["400", "700"], subsets: ["latin"] });
const mono  = DM_Mono({ weight: ["400", "500"], subsets: ["latin"] });

// ─── Hero app preview ────────────────────────────────────────────────────────

function HeroPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-amber-100/60 via-indigo-100/30 to-transparent blur-3xl rounded-[50px]" />

      {/* Floating notification — top right */}
      <div className="absolute -top-5 -right-5 z-10 animate-float bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-300/40 px-3.5 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <span className="text-emerald-600 text-xs font-black">✓</span>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-800 leading-none">Payment received</p>
          <p className="text-[9px] text-slate-400 mt-0.5">Rs 8,000 · Room 101</p>
        </div>
      </div>

      {/* Floating notification — bottom left */}
      <div className="absolute -bottom-5 -left-5 z-10 animate-float-2 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-300/40 px-3.5 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <span className="text-amber-600 text-[11px] font-black">!</span>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-800 leading-none">2 rents overdue</p>
          <p className="text-[9px] text-amber-600 mt-0.5 font-medium">Send WhatsApp →</p>
        </div>
      </div>

      {/* Floating stat — right mid */}
      <div className="absolute top-1/2 -translate-y-1/2 -right-8 z-10 animate-float-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30 px-3 py-2 text-center">
        <p className={`${mono.className} text-sm font-medium text-white leading-none`}>3/5</p>
        <p className="text-[8px] text-indigo-200 mt-0.5">Paid</p>
      </div>

      <div className="relative bg-white rounded-2xl shadow-2xl shadow-slate-300/50 border border-slate-200 overflow-hidden">
        {/* Browser chrome */}
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex items-center gap-3">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
          </div>
          <div className="flex-1 bg-slate-100 rounded-md px-3 py-1 max-w-[220px] mx-auto text-center">
            <span className="text-[10px] text-slate-400">easyrent.app/dashboard</span>
          </div>
          <div className="w-10 shrink-0" />
        </div>
        {/* App content */}
        <div className="p-4 bg-slate-50/40">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-slate-800 text-[13px]">Dashboard</span>
            <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2.5 py-1 rounded-lg shadow-sm">April 2026</span>
          </div>
          {/* Stat row */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { v: "8",    l: "Rooms",     tc: "text-indigo-600" },
              { v: "6",    l: "Tenants",   tc: "text-violet-600" },
              { v: "₹46k", l: "Collected", tc: "text-emerald-600" },
              { v: "2",    l: "Overdue",   tc: "text-rose-600"   },
            ].map(s => (
              <div key={s.l} className="bg-white rounded-xl border border-slate-100 p-2.5 shadow-sm">
                <p className={`font-black text-sm ${s.tc}`}>{s.v}</p>
                <p className="text-slate-400 text-[9px] mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
          {/* Payment list */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-50">
              <span className="text-[10px] font-semibold text-slate-400">April — 3 / 5 paid</span>
            </div>
            {[
              ["A. Gurung", "Room 101", "PAID",    "bg-emerald-50 text-emerald-700 border-emerald-100"],
              ["P. Nair",   "Room 102", "PARTIAL", "bg-blue-50 text-blue-700 border-blue-100"],
              ["R. Sharma", "Room 201", "OVERDUE", "bg-rose-50 text-rose-700 border-rose-100"],
              ["S. Tamang", "Room 202", "PAID",    "bg-emerald-50 text-emerald-700 border-emerald-100"],
            ].map(([name, room, status, cls]) => (
              <div key={String(name)} className="flex items-center justify-between px-3 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                    <span className="text-indigo-500 text-[8px] font-black">{(name as string)[0]}</span>
                  </div>
                  <div>
                    <p className="text-slate-700 text-[10px] font-semibold leading-none">{name}</p>
                    <p className="text-slate-400 text-[8px] mt-0.5">{room}</p>
                  </div>
                </div>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature visual previews ──────────────────────────────────────────────────

function BillingVisual() {
  return (
    <div className="w-full max-w-[300px] bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <span className="text-xs font-bold text-slate-700">April 2026</span>
        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-semibold">3 / 5 paid</span>
      </div>
      {[
        ["Ravi Sharma",   "Rs 8,000",  "PAID",    "bg-emerald-50 text-emerald-700 border-emerald-100"],
        ["Priya Nair",    "Rs 7,500",  "PARTIAL", "bg-blue-50 text-blue-700 border-blue-100"],
        ["Amit Joshi",    "Rs 9,000",  "OVERDUE", "bg-rose-50 text-rose-700 border-rose-100"],
        ["Sunita Thapa",  "Rs 6,500",  "PAID",    "bg-emerald-50 text-emerald-700 border-emerald-100"],
      ].map(([n, a, s, c]) => (
        <div key={String(n)} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50 last:border-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-black shrink-0">
              {(n as string)[0]}
            </div>
            <span className="text-sm font-medium text-slate-700">{n}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 tabular-nums">{a}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${c}`}>{s}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function WhatsAppVisual() {
  return (
    <div className="w-full max-w-[280px] space-y-2.5">
      <div className="bg-[#128c7e] rounded-2xl p-4 shadow-xl shadow-emerald-900/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle size={14} className="text-white" />
          </div>
          <div>
            <p className="text-white text-xs font-bold leading-none">EasyRent</p>
            <p className="text-white/50 text-[9px]">Payment reminder</p>
          </div>
        </div>
        <div className="bg-[#dcf8c6] rounded-xl rounded-tl-none p-3 text-[11px] text-slate-800 leading-relaxed">
          <p className="font-bold text-[#075e54] mb-1.5">Rent Due — April 2026</p>
          Dear Ravi,<br /><br />
          Your rent is due this month.<br />
          <span className="font-semibold">Amount: Rs 8,000</span><br />
          <span className="font-semibold">Due: April 1, 2026</span><br /><br />
          View your portal:<br />
          <span className="text-[#075e54] underline">easyrent.app/portal/…</span>
          <div className="flex justify-end mt-1.5">
            <span className="text-[9px] text-slate-400">10:32 AM ✓✓</span>
          </div>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-[10px] text-slate-400 leading-none">Sending to</p>
          <p className="text-xs font-semibold text-slate-800 mt-0.5">Ravi Sharma · +977-98XXXXXXXX</p>
        </div>
        <button className="w-8 h-8 rounded-full bg-[#25d366] flex items-center justify-center shadow-md shadow-emerald-500/30 shrink-0">
          <ArrowRight size={13} className="text-white" />
        </button>
      </div>
    </div>
  );
}

function PortalVisual() {
  return (
    <div className="w-full max-w-[280px] bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3.5">
        <p className="text-indigo-200 text-[9px] font-bold uppercase tracking-widest mb-0.5">Your portal</p>
        <p className="text-white font-bold text-sm">Priya Nair</p>
        <p className="text-indigo-200 text-[10px]">Room 102 · Move-in Jan 2025</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider mb-1">Current bill — April 2026</p>
          <p className="text-2xl font-black text-slate-900">Rs 7,500</p>
          <span className="inline-block mt-1 text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-semibold">
            PARTIAL · Rs 3,000 paid
          </span>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Payment history</p>
          <div className="space-y-1.5">
            {[["March 2026", "Rs 7,500", "PAID"], ["Feb 2026", "Rs 7,500", "PAID"], ["Jan 2026", "Rs 7,500", "PAID"]].map(([m, a, s]) => (
              <div key={m} className="flex justify-between text-[10px] py-1 border-b border-slate-50 last:border-0">
                <span className="text-slate-400">{m}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-mono tabular-nums">{a}</span>
                  <span className="text-emerald-600 font-bold">{s} ✓</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const painPoints = [
  { icon: "📓", title: "Tracking payments in a notebook",    desc: "Flipping through pages to find who paid this month — and inevitably missing someone." },
  { icon: "📲", title: "Chasing tenants on WhatsApp",        desc: "Typing the same reminder message to every tenant, one by one, every month." },
  { icon: "🧮", title: "Calculating electricity + rent manually", desc: "Adding up base rent, electricity units, water for each tenant every time." },
  { icon: "🔍", title: "Can't find old payment records",     desc: "When a dispute arises, you spend an hour digging for that one transaction." },
];

const testimonials = [
  {
    name: "Rajesh Gurung",
    role: "8 rooms · Kathmandu",
    quote: "Before EasyRent I was using a diary for everything. Now I open the app, see who's paid, and send reminders in one click. The WhatsApp feature alone saves me hours every month.",
    initials: "RG",
    avatarBg: "bg-amber-100 text-amber-700",
  },
  {
    name: "Sunita Sharma",
    role: "12 rooms · Lalitpur",
    quote: "My tenants love the portal. They see their bill, past payments, and download receipts themselves. I barely get payment-related calls anymore.",
    initials: "SS",
    avatarBg: "bg-indigo-100 text-indigo-700",
  },
  {
    name: "Bikash Thapa",
    role: "5 rooms · Pokhara",
    quote: "Setup took 15 minutes. I added my rooms and tenants, and it started generating bills automatically. Exactly what I needed — nothing more, nothing less.",
    initials: "BT",
    avatarBg: "bg-emerald-100 text-emerald-700",
  },
];

const features: { tag: string; title: string; desc: string; points: string[]; Visual: () => React.ReactElement }[] = [
  {
    tag: "Auto-billing",
    title: "Bills generate themselves — every month.",
    desc: "Set up your rooms once. EasyRent creates rent bills on the 1st of each month, tracks partial payments, marks overdue accounts, and keeps a full audit trail.",
    points: [
      "Auto-generates from move-in date",
      "Supports partial payments",
      "Marks overdue automatically",
      "Complete payment history",
    ],
    Visual: BillingVisual,
  },
  {
    tag: "WhatsApp reminders",
    title: "Send payment reminders with one click.",
    desc: "Connected to WhatsApp? Send a professional payment reminder to any tenant instantly — with their balance, due date, and portal link included.",
    points: [
      "Connects to your WhatsApp number",
      "Professional formatted message",
      "Portal link auto-included",
      "Works from the payment screen",
    ],
    Visual: WhatsAppVisual,
  },
  {
    tag: "Tenant portal",
    title: "Every tenant gets their own private portal.",
    desc: "Share a unique link. Your tenant sees their current bill, full payment history, and PDF receipts — no login needed. No more 'how much do I owe?' calls.",
    points: [
      "No password — link is the access key",
      "Current bill + full history",
      "Downloadable PDF receipts",
      "Maintenance request form",
    ],
    Visual: PortalVisual,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      <LandingNavbar />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="pt-28 pb-20 sm:pt-36 sm:pb-28 relative overflow-hidden">
        {/* subtle warm grid */}
        <div className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-100" />
        {/* warm radial fade */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_60%_40%,rgba(251,191,36,0.07),transparent)]" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-14 items-center">

            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold tracking-[0.15em] uppercase px-3.5 py-1.5 rounded-full mb-7 animate-fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                Now in beta — free founding member access
              </div>

              <h1 className={`${serif.className} text-5xl sm:text-6xl lg:text-[66px] leading-[1.07] text-slate-900 dark:text-white mb-6 animate-fade-up`}>
                Rent collection,<br />
                <span className="relative inline-block">
                  <em className="not-italic text-amber-600">finally</em>
                  <span className="absolute -bottom-1 left-0 h-[3px] bg-amber-300/70 rounded-full animate-underline-grow" />
                </span>{" "}
                under control.
              </h1>

              <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mb-10 animate-fade-up stagger-1">
                EasyRent handles billing, payment tracking, WhatsApp reminders, and tenant portals — all in one place. Stop managing rent in notebooks.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10 animate-fade-up stagger-2">
                <Link href="/signup"
                  className="btn-shimmer inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-7 py-3.5 rounded-xl text-sm shadow-lg shadow-slate-900/20 transition-all duration-200 active:scale-[0.98]">
                  Get Started Free <ArrowRight size={15} />
                </Link>
                <a href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 px-7 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-sm">
                  See how it works
                </a>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400 animate-fade-up stagger-3">
                {["Free for up to 3 rooms", "No credit card", "Set up in 5 minutes"].map(t => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check size={13} className="text-emerald-500 shrink-0" /> {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — preview */}
            <div className="hidden lg:block animate-fade-up stagger-2">
              <HeroPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────── */}
      <div className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { num: "140+",   label: "Landlords using EasyRent" },
              { num: "₹18L+",  label: "Rent collected via app"   },
              { num: "2,400+", label: "Bills auto-generated"      },
              { num: "4.9/5",  label: "Rating from beta users"   },
            ].map(s => (
              <div key={s.label} className="text-center border-r border-slate-100 dark:border-slate-800 last:border-0">
                <p className={`${mono.className} text-3xl sm:text-4xl text-slate-900 dark:text-white mb-1 tabular-nums`}>{s.num}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Pain points ──────────────────────────────────────────── */}
      <section className="py-24 bg-slate-950 text-white relative overflow-hidden">
        <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-amber-500/5 blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-amber-400 text-[11px] font-bold tracking-[0.22em] uppercase mb-4">The old way</p>
            <h2 className={`${serif.className} text-4xl sm:text-5xl text-white mb-4`}>Sound familiar?</h2>
            <p className="text-white/40 text-lg max-w-sm mx-auto">Every landlord we spoke to said the same things.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-14">
            {painPoints.map(p => (
              <div key={p.title} className="scroll-reveal flex gap-4 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:bg-white/[0.06] transition-colors">
                <span className="text-2xl shrink-0 mt-0.5">{p.icon}</span>
                <div>
                  <p className="font-semibold text-white text-[15px] mb-1.5 leading-snug">{p.title}</p>
                  <p className="text-white/40 text-sm leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className={`${serif.className} text-2xl sm:text-3xl text-white/60 italic`}>
              There's a better way.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="py-24 sm:py-32 bg-[#faf9f6] dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-indigo-600 text-[11px] font-bold tracking-[0.22em] uppercase mb-4">Features</p>
            <h2 className={`${serif.className} text-4xl sm:text-5xl text-slate-900 dark:text-white dark:text-white mb-5`}>
              Everything in one place.
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mx-auto">
              No more switching between notebooks, spreadsheets, and WhatsApp.
            </p>
          </div>

          <div className="space-y-5">
            {features.map(({ tag, title, desc, points, Visual }, i) => (
              <div key={tag}
                className="scroll-reveal grid md:grid-cols-2 gap-0 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-slate-900/60 transition-all duration-500 group">
                {/* Text — alternate sides */}
                <div className={`p-8 sm:p-10 ${i % 2 === 1 ? "md:order-2" : ""}`}>
                  <span className={`inline-block text-[10px] font-bold tracking-[0.18em] uppercase px-3 py-1.5 rounded-full mb-5 ${
                    i === 0 ? "bg-amber-100 text-amber-700" :
                    i === 1 ? "bg-emerald-100 text-emerald-700" :
                              "bg-indigo-100 text-indigo-700"
                  }`}>
                    {tag}
                  </span>
                  <h3 className={`${serif.className} text-2xl sm:text-[28px] text-slate-900 dark:text-white mb-4 leading-tight`}>
                    {title}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed mb-6">{desc}</p>
                  <ul className="space-y-2.5">
                    {points.map(pt => (
                      <li key={pt} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          i === 0 ? "bg-amber-500" : i === 1 ? "bg-emerald-500" : "bg-indigo-500"
                        }`} />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Visual */}
                <div className={`flex items-center justify-center p-8 sm:p-10 min-h-[260px] ${
                  i % 2 === 1 ? "md:order-1" : ""
                } bg-gradient-to-br ${
                  i === 0 ? "from-slate-50 to-amber-50/30 border-t md:border-t-0 md:border-l border-slate-100" :
                  i === 1 ? "from-slate-50 to-emerald-50/30 border-t md:border-t-0 md:border-r border-slate-100" :
                             "from-slate-50 to-indigo-50/30 border-t md:border-t-0 md:border-l border-slate-100"
                }`}>
                  <Visual />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────── */}
      <section className="py-24 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-rose-500 text-[11px] font-bold tracking-[0.22em] uppercase mb-4">From the beta</p>
            <h2 className={`${serif.className} text-4xl sm:text-5xl text-slate-900 dark:text-white dark:text-white`}>Landlords love it.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div key={t.name}
                className={`scroll-reveal scroll-reveal-delay-${i + 1} flex flex-col bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-6 hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-slate-900/60 hover:-translate-y-0.5 transition-all duration-300`}>
                <Quote size={28} className="text-slate-200 mb-4 shrink-0" />
                <p className="text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed flex-1 mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${t.avatarBg}`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none mb-0.5">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 sm:py-32 bg-[#faf9f6] dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-violet-600 text-[11px] font-bold tracking-[0.22em] uppercase mb-4">How it works</p>
            <h2 className={`${serif.className} text-4xl sm:text-5xl text-slate-900 dark:text-white dark:text-white mb-5`}>
              Up and running in minutes.
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mx-auto">
              No training needed. Add your property and start tracking today.
            </p>
          </div>

          <div className="relative">
            <div className="hidden sm:block absolute left-8 top-8 bottom-8 w-px bg-gradient-to-b from-amber-300 via-indigo-300 to-violet-300" />
            <div className="space-y-6">
              {[
                { num: "01", Icon: DoorOpen,  title: "Add your rooms",   desc: "Create a room for each unit with monthly rent and recurring charges (electricity, water). Done once — applied every month forever." },
                { num: "02", Icon: Users,      title: "Add your tenants", desc: "Enter move-in dates and contact details. Billing starts automatically from their first month. No manual invoice creation, ever." },
                { num: "03", Icon: CreditCard, title: "Track & collect",  desc: "Record payments as they arrive. Send WhatsApp reminders, share receipt links, and see at a glance exactly who owes what." },
              ].map(({ num, Icon, title, desc }) => (
                <div key={num} className="scroll-reveal flex gap-5 sm:gap-7 items-start">
                  <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center shrink-0 shadow-sm z-10">
                    <span className="text-[9px] font-black text-slate-300 leading-none tracking-widest">{num}</span>
                    <Icon size={20} className="text-slate-700 dark:text-slate-300 mt-1" />
                  </div>
                  <div className="pt-3">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2">{title}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 sm:py-32 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-emerald-600 text-[11px] font-bold tracking-[0.22em] uppercase mb-4">Pricing</p>
            <h2 className={`${serif.className} text-4xl sm:text-5xl text-slate-900 dark:text-white dark:text-white mb-4`}>Simple, honest pricing.</h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Start free. Upgrade when you have more rooms.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {/* Free */}
            <div className="scroll-reveal bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 flex flex-col hover:shadow-md transition-shadow">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-5">Free</p>
              <div className="flex items-end gap-1.5 mb-1">
                <span className={`${serif.className} text-5xl text-slate-900 dark:text-white`}>Rs 0</span>
                <span className="text-slate-400 text-sm mb-2">/month</span>
              </div>
              <p className="text-slate-400 text-sm mb-7">Forever, for up to 3 rooms</p>
              <Link href="/signup"
                className="block text-center border border-slate-300 dark:border-slate-600 hover:border-slate-400 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-3 rounded-xl text-sm transition-all mb-8 shadow-sm">
                Get Started Free
              </Link>
              <ul className="space-y-3 flex-1">
                {["Up to 3 rooms", "Unlimited tenants", "Monthly auto-billing", "Tenant self-service portal", "Dashboard & reports", "Move-in anniversary alerts"].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                    <Check size={13} className="text-emerald-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="scroll-reveal scroll-reveal-delay-1 relative bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col hover:shadow-xl hover:shadow-slate-900/20 transition-shadow">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-900 text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-amber-400/30">
                  <Star size={10} fill="currentColor" /> Coming Soon
                </span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-5 mt-2">Pro</p>
              <div className="flex items-end gap-1.5 mb-1">
                <span className={`${serif.className} text-5xl text-white`}>TBD</span>
              </div>
              <p className="text-slate-500 text-sm mb-7">Per month · unlimited rooms</p>
              <button disabled
                className="block w-full text-center bg-white/8 text-white/30 cursor-not-allowed font-semibold py-3 rounded-xl text-sm mb-8 border border-white/10">
                Coming Soon
              </button>
              <ul className="space-y-3 flex-1">
                {["Unlimited rooms", "Everything in Free", "PDF receipt generation", "WhatsApp reminders", "Advanced analytics", "CSV / Excel export", "Priority support"].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-400">
                    <Check size={13} className="text-indigo-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Founding member callout */}
          <div className="mt-7 max-w-3xl mx-auto">
            <div className="flex items-start sm:items-center gap-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl px-6 py-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Zap size={17} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900 mb-0.5">Founding Member Perk</p>
                <p className="text-sm text-amber-700/70">Sign up during beta and keep full Pro access free forever — no catch, no expiry date.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="bg-slate-950 py-28 relative overflow-hidden">
        <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="pointer-events-none absolute top-0 left-1/3 w-[500px] h-[400px] rounded-full bg-amber-500/6 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-indigo-600/8 blur-[100px]" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-amber-400 text-[11px] font-bold tracking-[0.22em] uppercase mb-6">Get started today</p>
          <h2 className={`${serif.className} text-4xl sm:text-5xl lg:text-6xl text-white mb-6 leading-[1.1]`}>
            Your tenants deserve<br />
            a better experience.
          </h2>
          <p className="text-white/40 text-lg mb-10 max-w-md mx-auto leading-relaxed">
            Stop chasing payments and losing records. Takes less than 5 minutes to set up.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup"
              className="btn-shimmer inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold px-10 py-4 rounded-xl text-sm shadow-[0_4px_28px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_36px_rgba(245,158,11,0.5)] transition-all duration-200 active:scale-[0.97]">
              Get Started Free <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="text-white/30 hover:text-white/60 text-sm transition-colors">
              Already have an account? Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="bg-slate-950 border-t border-white/[0.05] py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <LogoMark size={30} />
              <div>
                <p className="font-bold text-white text-sm leading-none">EasyRent</p>
                <p className="text-white/20 text-[11px] mt-0.5">by XpertThemes</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/30">
              <a href="#features"     className="hover:text-white/65 transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-white/65 transition-colors">How it works</a>
              <a href="#pricing"      className="hover:text-white/65 transition-colors">Pricing</a>
              <Link href="/login"     className="hover:text-white/65 transition-colors">Sign in</Link>
              <Link href="/signup"    className="hover:text-white/65 transition-colors">Get started</Link>
            </div>
            <p className="text-white/15 text-xs">&copy; {new Date().getFullYear()} XpertThemes.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
