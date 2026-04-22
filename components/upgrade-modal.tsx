"use client";

import { X, Crown, Check, Send, Loader2, CheckCircle2, Copy, ChevronRight, Zap } from "lucide-react";
import { useEffect, useState } from "react";
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

interface Props {
  open:     boolean;
  onClose:  () => void;
  feature?: string;
}

type Step = "info" | "pay" | "confirm" | "done";
type BillingCycle = "yearly" | "lifetime";

export function UpgradeModal({ open, onClose, feature }: Props) {
  const [step,      setStep]      = useState<Step>("info");
  const [plan,      setPlan]      = useState<PlanId>("basic");
  const [billing,   setBilling]   = useState<BillingCycle>("yearly");
  const [payMethod, setPayMethod] = useState<typeof PAYMENT_METHODS[number]["id"]>("esewa");
  const [payRef,    setPayRef]    = useState("");
  const [message,   setMessage]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [copied,    setCopied]    = useState(false);

  useEffect(() => {
    if (open) { setStep("info"); setPayRef(""); setMessage(""); setCopied(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

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
      if (res.ok) setStep("done");
    } catch { setStep("done"); }
    finally   { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* ── info ─────────────────────────────────────────────────── */}
        {step === "info" && (
          <>
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-6 pt-6 pb-8 text-white relative">
              <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"><X size={16} /></button>
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3"><Crown size={24} /></div>
              <h3 className="text-lg font-bold">Choose a Plan</h3>
              {feature && <p className="text-sm text-white/80 mt-1"><span className="font-semibold text-white">{feature}</span> requires a paid plan.</p>}
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Billing toggle */}
              <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
                {(["yearly", "lifetime"] as BillingCycle[]).map(c => (
                  <button key={c} onClick={() => setBilling(c)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${billing === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                    {c === "yearly" ? (
                      <span className="flex items-center justify-center gap-1">Yearly <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1 rounded-full">Save 2m</span></span>
                    ) : (
                      <span className="flex items-center justify-center gap-1">Lifetime <span className="bg-amber-100 text-amber-700 text-[10px] px-1 rounded-full">Once</span></span>
                    )}
                  </button>
                ))}
              </div>

              {/* Plan cards */}
              <div className="space-y-2">
                {(Object.values(PLANS) as typeof PLANS[PlanId][]).map(p => {
                  const isSelected = plan === p.id;
                  const planPrice  = p[billing];
                  return (
                    <button key={p.id} onClick={() => setPlan(p.id as PlanId)}
                      className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${isSelected ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {p.id === "pro"     && <Crown size={13} className="text-amber-500" />}
                          {p.id === "starter" && <Zap   size={13} className="text-violet-500" />}
                          {p.id === "basic"   && <Zap   size={13} className="text-indigo-400" />}
                          <span className="text-sm font-bold text-slate-900">{p.name}</span>
                          {p.highlight && <span className="text-[9px] bg-violet-100 text-violet-700 font-bold px-1.5 py-0.5 rounded-full">Popular</span>}
                          {p.id === "pro" && <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">Best value</span>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-extrabold text-slate-900">Rs. {planPrice.amount.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400 ml-1">{billing === "lifetime" ? "once" : "/yr"}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 pl-5">{p.desc}</p>
                    </button>
                  );
                })}
              </div>

              <button onClick={() => setStep("pay")}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                Get {selectedPlan.name} — {price.label} <ChevronRight size={15} />
              </button>
              <button onClick={onClose} className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm transition-colors">Maybe later</button>
            </div>
          </>
        )}

        {/* ── pay ──────────────────────────────────────────────────── */}
        {step === "pay" && (
          <>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Step 1 — Pay</h3>
                <p className="text-xs text-slate-400 mt-0.5">Send <span className="font-semibold text-slate-700">{price.label}</span></p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map(m => (
                  <button key={m.id} onClick={() => setPayMethod(m.id)}
                    className={`py-3 rounded-xl text-[11px] font-bold border-2 transition-all min-h-[44px] ${payMethod === m.id ? "border-transparent text-white" : "border-slate-200 text-slate-500 bg-white"}`}
                    style={payMethod === m.id ? { backgroundColor: m.color } : {}}>
                    {m.name}
                  </button>
                ))}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                {selectedMethod.number ? (
                  <>
                    {"qr" in selectedMethod && selectedMethod.qr && (
                      <div className="flex justify-center">
                        <div className="bg-white rounded-xl p-2 shadow-sm border border-slate-200 w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center overflow-hidden">
                          <Image src={selectedMethod.qr} alt={`${selectedMethod.name} QR`} width={144} height={144} className="object-contain rounded-lg w-full h-full" />
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 text-center">Scan QR or send to number below</p>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold text-slate-900">{selectedMethod.number}</p>
                      <button onClick={() => handleCopy(selectedMethod.number!)}
                        className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1">
                        <Copy size={11} />{copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{selectedMethod.holder}</span>
                      <span className="font-bold text-amber-600">{price.label}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2 space-y-2">
                    <p className="text-sm text-slate-600">{"note" in selectedMethod ? selectedMethod.note : ""}</p>
                    <a href="https://wa.me/9779866297369" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                      WhatsApp us
                    </a>
                  </div>
                )}
              </div>

              <button onClick={() => setStep("confirm")}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                I&apos;ve paid — Continue <ChevronRight size={15} />
              </button>
              <button onClick={() => setStep("info")} className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm transition-colors">Back</button>
            </div>
          </>
        )}

        {/* ── confirm ───────────────────────────────────────────────── */}
        {step === "confirm" && (
          <>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Step 2 — Confirm</h3>
                <p className="text-xs text-slate-400 mt-0.5">Enter your transaction ID to verify</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Transaction / Reference ID <span className="text-red-400 normal-case font-normal">*</span>
                </label>
                <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)}
                  placeholder="e.g. T240410XXXXXX"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white font-mono" />
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

              <div className="flex gap-2">
                <button onClick={() => setStep("pay")} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition-colors">Back</button>
                <button onClick={handleSubmit} disabled={loading || !payRef.trim()}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {loading ? "Sending…" : "Submit"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── done ─────────────────────────────────────────────────── */}
        {step === "done" && (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Request sent!</h3>
              <p className="text-sm text-slate-500 mt-1.5">We&apos;ll verify your payment and activate your {selectedPlan.name} plan shortly. You&apos;ll be notified via WhatsApp.</p>
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors">Done</button>
          </div>
        )}

      </div>
    </div>
  );
}
