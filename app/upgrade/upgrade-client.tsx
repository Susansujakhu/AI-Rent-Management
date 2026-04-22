"use client";

import { Crown, CheckCircle2, Clock, Send, Loader2, Check, Copy, ChevronRight, Zap, Timer } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { PLANS, PAYMENT_METHODS, type PlanId } from "@/lib/pricing";

const PLAN_FEATURES: Record<PlanId, string[]> = {
  basic: [
    "Up to 3 rooms",
    "Unlimited tenants",
    "WhatsApp notifications",
    "Tenant self-service portal",
    "Export reports (CSV)",
    "Automatic overdue reminders",
  ],
  starter: [
    "Up to 5 rooms",
    "Unlimited tenants",
    "WhatsApp notifications",
    "Tenant self-service portal",
    "Export reports (CSV)",
    "Automatic overdue reminders",
  ],
  pro: [
    "Unlimited rooms & tenants",
    "WhatsApp notifications",
    "Tenant self-service portal",
    "Export reports (CSV)",
    "Automatic overdue reminders",
  ],
};

type BillingCycle = "yearly" | "lifetime";
type PayStep      = "info" | "pay" | "confirm" | "done";

import type { PlanStatus } from "@/lib/plan";

interface Props {
  planStatus:         PlanStatus;
  trialDaysLeft:      number;
  upgradeRequestedAt: string | null;
}

export function UpgradeClient({ planStatus, trialDaysLeft, upgradeRequestedAt: initialReq }: Props) {
  const [step,      setStep]      = useState<PayStep>("info");
  const [plan,      setPlan]      = useState<PlanId>("basic");
  const [billing,   setBilling]   = useState<BillingCycle>("yearly");
  const [payMethod, setPayMethod] = useState<typeof PAYMENT_METHODS[number]["id"]>("esewa");
  const [payRef,    setPayRef]    = useState("");
  const [message,   setMessage]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [reqAt,     setReqAt]     = useState<string | null>(initialReq);

  const isPending      = !!reqAt && planStatus !== "pro" && planStatus !== "starter";
  const selectedPlan   = PLANS[plan];
  const price          = selectedPlan[billing];
  const selectedMethod = PAYMENT_METHODS.find(m => m.id === payMethod)!;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/upgrade-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message, paymentRef: payRef.trim(), paymentMethod: payMethod, billingCycle: billing, amount: price.amount, plan }),
      });
      if (res.ok) { setStep("done"); setReqAt(new Date().toISOString()); }
    } catch { setStep("done"); setReqAt(new Date().toISOString()); }
    finally  { setLoading(false); }
  };

  // ── Already on paid plan ──────────────────────────────────────────────────
  if (planStatus === "pro" || planStatus === "starter" || planStatus === "basic") {
    const currentPlan = PLANS[planStatus as PlanId];
    const canUpgrade  = planStatus !== "pro";
    return (
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center text-center gap-5">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
          <Crown size={36} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">You&apos;re on {currentPlan.name}!</h1>
          <p className="text-slate-500 mt-2 text-sm">{currentPlan.desc} — all features unlocked.</p>
        </div>
        {canUpgrade && (
          <button onClick={() => { setPlan((planStatus as PlanId) === "basic" ? "starter" : "pro"); setStep("info"); }}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
            <Crown size={15} /> Upgrade for more rooms
          </button>
        )}
      </div>
    );
  }

  // ── Awaiting verification ─────────────────────────────────────────────────
  if (step === "done" || isPending) {
    const timestamp = reqAt ? new Date(reqAt).toLocaleString() : "";
    return (
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center text-center gap-5">
        <div className="w-20 h-20 rounded-3xl bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={36} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Awaiting Verification</h1>
          <p className="text-slate-500 mt-2 text-sm">Your payment request has been sent. Once verified, your plan will be activated.</p>
        </div>
        <div className="w-full bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3 text-left">
          <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Verification in progress</p>
            {timestamp && <p className="text-xs text-amber-600 mt-0.5">Submitted on {timestamp}</p>}
          </div>
        </div>
        <p className="text-xs text-slate-400">You&apos;ll be notified via WhatsApp once activated. You may need to log out and back in.</p>
      </div>
    );
  }

  // ── Trial banner (show on info step if still on trial) ───────────────────
  const trialBanner = planStatus === "trial" && trialDaysLeft > 0 && (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${trialDaysLeft <= 7 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"}`}>
      <Timer size={18} className={trialDaysLeft <= 7 ? "text-rose-500 shrink-0" : "text-emerald-500 shrink-0"} />
      <div>
        <p className={`text-sm font-semibold ${trialDaysLeft <= 7 ? "text-rose-800" : "text-emerald-800"}`}>
          {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in your free trial
        </p>
        <p className={`text-xs mt-0.5 ${trialDaysLeft <= 7 ? "text-rose-600" : "text-emerald-600"}`}>
          Upgrade now to keep full access after your trial ends.
        </p>
      </div>
    </div>
  );

  const expiredBanner = planStatus === "expired" && (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-rose-50 border border-rose-100">
      <Timer size={18} className="text-rose-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-rose-800">Your free trial has expired</p>
        <p className="text-xs text-rose-600 mt-0.5">Choose a plan below to continue using Rent Manager.</p>
      </div>
    </div>
  );

  // ── Step: info ────────────────────────────────────────────────────────────
  if (step === "info") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-6 md:space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Choose a Plan</h1>
          <p className="text-sm text-slate-400 mt-2">3 months free trial, then pick what fits your size.</p>
        </div>

        {/* Banners */}
        <div className="max-w-xl mx-auto space-y-3">
          {trialBanner}
          {expiredBanner}
        </div>

        {/* Billing toggle */}
        <div className="flex rounded-xl bg-slate-100 p-1 gap-1 max-w-xs mx-auto">
          {(["yearly", "lifetime"] as BillingCycle[]).map(c => (
            <button key={c} onClick={() => setBilling(c)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${billing === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              {c === "yearly" ? (
                <span className="flex items-center justify-center gap-1.5">
                  Yearly <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 rounded-full font-bold">Save 2m</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  Lifetime <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 rounded-full font-bold">Once</span>
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Plan cards — 1 col mobile, 3 col desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {(Object.values(PLANS) as typeof PLANS[PlanId][]).map(p => {
            const isSelected = plan === p.id;
            const planPrice  = p[billing];
            return (
              <button key={p.id} onClick={() => setPlan(p.id as PlanId)}
                className={`relative w-full text-left rounded-2xl border-2 p-5 md:p-6 transition-all flex flex-col ${
                  isSelected
                    ? "border-amber-400 bg-amber-50 shadow-lg shadow-amber-100"
                    : "border-slate-200 hover:border-slate-300 bg-white hover:shadow-md"
                }`}>
                {/* Badges */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {p.id === "pro"     && <Crown size={16} className="text-amber-500" />}
                  {p.id === "starter" && <Zap   size={16} className="text-violet-500" />}
                  {p.id === "basic"   && <Zap   size={16} className="text-indigo-400" />}
                  <span className="text-base font-bold text-slate-900">{p.name}</span>
                  {p.highlight && (
                    <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-1.5 py-0.5 rounded-full">Popular</span>
                  )}
                  {p.id === "pro" && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">Best value</span>
                  )}
                </div>

                {/* Price */}
                <div className="mb-4 md:mb-6">
                  <span className="text-3xl md:text-4xl font-extrabold text-slate-900">
                    Rs. {planPrice.amount.toLocaleString()}
                  </span>
                  <span className="text-sm text-slate-400 ml-1">
                    {billing === "lifetime" ? "one-time" : "/ year"}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">{p.desc}</p>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1">
                  {PLAN_FEATURES[p.id as PlanId].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-emerald-600" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Select indicator */}
                <div className={`mt-5 py-2.5 rounded-xl text-sm font-semibold text-center transition-all ${
                  isSelected
                    ? "bg-amber-500 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}>
                  {isSelected ? "Selected" : "Select"}
                </div>
              </button>
            );
          })}
        </div>

        <div className="max-w-sm mx-auto">
          <button onClick={() => setStep("pay")}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-200">
            Get {selectedPlan.name} — {price.label} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Step: pay ─────────────────────────────────────────────────────────────
  if (step === "pay") {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 space-y-5">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Step 1 of 2</p>
          <h1 className="text-xl font-bold text-slate-900">Make Payment</h1>
          <p className="text-sm text-slate-500 mt-1">Send <span className="font-semibold text-slate-800">{price.label}</span> using any method below</p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {PAYMENT_METHODS.map(m => (
            <button key={m.id} onClick={() => setPayMethod(m.id)}
              className={`py-3 rounded-xl text-[11px] font-bold border-2 transition-all min-h-[44px] ${payMethod === m.id ? "border-transparent text-white" : "border-slate-200 text-slate-500 bg-white"}`}
              style={payMethod === m.id ? { backgroundColor: m.color } : {}}>
              {m.name}
            </button>
          ))}
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
          {selectedMethod.number ? (
            <>
              {"qr" in selectedMethod && selectedMethod.qr && (
                <div className="flex justify-center">
                  <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 w-40 h-40 sm:w-52 sm:h-52 flex items-center justify-center overflow-hidden">
                    <Image src={selectedMethod.qr} alt={`${selectedMethod.name} QR`} width={192} height={192} className="object-contain rounded-xl w-full h-full" />
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-400 text-center">Scan QR or send to number below</p>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-bold text-slate-900">{selectedMethod.number}</p>
                <button onClick={() => handleCopy(selectedMethod.number!)}
                  className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <Copy size={12} />{copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="flex justify-between">
                <p className="text-sm text-slate-500">{selectedMethod.holder}</p>
                <p className="text-sm font-bold text-amber-600">{price.label}</p>
              </div>
            </>
          ) : (
            <div className="text-center py-3 space-y-3">
              <p className="text-sm text-slate-600">{"note" in selectedMethod ? selectedMethod.note : ""}</p>
              <a href="https://wa.me/9779866297369" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                Open WhatsApp
              </a>
            </div>
          )}
        </div>

        <button onClick={() => setStep("confirm")}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
          I&apos;ve paid — Continue <ChevronRight size={16} />
        </button>
        <button onClick={() => setStep("info")} className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm transition-colors">Back</button>
      </div>
    );
  }

  // ── Step: confirm ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-5">
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Step 2 of 2</p>
        <h1 className="text-xl font-bold text-slate-900">Confirm Payment</h1>
        <p className="text-sm text-slate-500 mt-1">Enter your transaction ID so we can verify quickly</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Transaction / Reference ID <span className="text-red-400 normal-case font-normal">*</span>
          </label>
          <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="e.g. T240410XXXXXX"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white font-mono" />
          <p className="text-xs text-slate-400 mt-1">Find this in your {selectedMethod.name} receipt</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Note <span className="normal-case text-slate-400 font-normal">(optional)</span></label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} maxLength={300}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white" />
        </div>

        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800">
          Your name, email and phone will be shared for verification.
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setStep("pay")} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-semibold transition-colors">Back</button>
        <button onClick={handleSubmit} disabled={loading || !payRef.trim()}
          className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {loading ? "Sending…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
