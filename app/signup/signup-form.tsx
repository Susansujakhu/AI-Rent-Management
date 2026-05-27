"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, MessageCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import Link from "next/link";
import { COUNTRY_CODES, DEFAULT_CC } from "@/lib/country-codes";
import { Playfair_Display } from "next/font/google";

const serif = Playfair_Display({ weight: ["400", "700"], subsets: ["latin"] });

type Step = "form" | "verify";

export function SignupForm() {
  const router = useRouter();

  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [countryCode,     setCountryCode]     = useState(DEFAULT_CC);
  const [localPhone,      setLocalPhone]      = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass,        setShowPass]        = useState(false);

  const [step,       setStep]       = useState<Step>("form");
  const [masked,     setMasked]     = useState("");
  const [otp,        setOtp]        = useState("");

  const [sending,    setSending]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-400/20 transition-all";
  const fullPhone = `+${countryCode}${localPhone.replace(/\D/g, "")}`;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address"); return; }
    if (!password) { setError("Password is required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!localPhone.trim()) { setError("Phone number is required"); return; }

    setSending(true);
    try {
      // Send password too so the OTP endpoint can validate it server-side
      // BEFORE burning an OTP. Anything that passes here will pass /signup.
      const res  = await fetch("/api/auth/send-phone-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: fullPhone, email: email.trim() || undefined, password }),
      });
      const data = await res.json() as { ok?: boolean; masked?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to send code"); return; }
      setMasked(data.masked ?? fullPhone);
      setStep("verify");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit code"); return; }

    setSubmitting(true);
    try {
      const res  = await fetch("/api/auth/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim() || undefined, email, phone: fullPhone, password, otp }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const strength      = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const strengthLabel = ["", "Weak", "Good", "Strong"];
  const strengthColor = ["", "bg-rose-500", "bg-amber-400", "bg-emerald-500"];

  return (
    <div className="min-h-screen flex bg-[#faf9f6]">

      {/* ── Left panel — dark brand ── */}
      <div className="hidden lg:flex lg:flex-[5] bg-slate-950 relative overflow-hidden items-center justify-center p-16">
        <div className="pointer-events-none absolute top-1/4 -left-20 w-[500px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-amber-500/6 blur-[100px]" />

        <div className="relative z-10 max-w-md">
          <div className="mb-14">
            <LogoMark size={56} tone="dark" />
          </div>

          <h2 className={`${serif.className} text-5xl text-white leading-[1.1] mb-5`}>
            Stop managing rent<br />
            <span className="text-amber-400">in notebooks.</span>
          </h2>
          <p className="text-white/40 text-base mb-12 leading-relaxed">
            Set up your property in minutes. Free forever for up to 3 rooms.
          </p>

          <div className="space-y-4">
            {[
              { t: "Automatic monthly billing",   d: "Bills generate themselves every month" },
              { t: "WhatsApp payment reminders",  d: "Remind tenants with one click" },
              { t: "Tenant self-service portal",  d: "Tenants see dues & receipts without calling you" },
              { t: "Reports & expense tracking",  d: "6-month trends, overdue alerts" },
            ].map(f => (
              <div key={f.t} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={10} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-white/75 text-sm font-medium">{f.t}</p>
                  <p className="text-white/35 text-xs mt-0.5">{f.d}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Founding member callout */}
          <div className="mt-10 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-3.5">
            <span className="text-xl shrink-0">🎁</span>
            <div>
              <p className="text-amber-300 text-sm font-semibold leading-none mb-1">Founding Member Offer</p>
              <p className="text-amber-400/60 text-xs">Sign up during beta → Full access free, forever</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — light form ── */}
      <div className="w-full lg:flex-[4] min-h-screen flex items-center justify-center p-6 relative">
        <Link href="/"
          className="absolute top-5 left-5 z-20 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors group">
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        <div className="animate-scale-in relative z-10 w-full max-w-[400px]">
          <div className="text-center mb-7">
            <div className="flex justify-center mb-5 lg:hidden">
              <LogoMark size={56} tone="light" />
            </div>
            <h1 className={`${serif.className} text-[2rem] text-slate-900 mb-1`}>
              {step === "form" ? "Create account" : "Verify phone"}
            </h1>
            <p className="text-sm text-slate-400">
              {step === "form" ? "Free forever — no credit card required" : "Check your WhatsApp for the code"}
            </p>
          </div>

          {/* ── Step 1: Form ── */}
          {step === "form" && (
            <form onSubmit={handleSendCode} className="bg-white border border-slate-200 rounded-3xl shadow-sm shadow-slate-200/60 p-7 space-y-4">

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">
                  Name <span className="normal-case font-normal text-slate-300">(optional)</span>
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name" autoFocus autoComplete="name" className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">
                  Email <span className="normal-case font-normal text-slate-300">(optional)</span>
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">
                  Phone Number <span className="text-rose-400 normal-case font-normal">*</span>
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all">
                  <select
                    value={countryCode}
                    onChange={e => setCountryCode(e.target.value)}
                    className="bg-slate-50 text-slate-700 text-sm px-3 py-3.5 border-r border-slate-200 focus:outline-none cursor-pointer shrink-0"
                    style={{ maxWidth: "90px" }}
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>+{c.code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={localPhone}
                    onChange={e => setLocalPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="9866XXXXXX"
                    autoComplete="tel-national"
                    className="flex-1 bg-transparent px-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none"
                  />
                </div>
                <p className="text-slate-400 text-xs">A WhatsApp verification code will be sent.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">Password</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters" autoComplete="new-password"
                    className={`${inputCls} pr-12`} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1">
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${strength >= i ? strengthColor[strength] : "bg-slate-100"}`} />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${strength === 1 ? "text-rose-500" : strength === 2 ? "text-amber-500" : "text-emerald-500"}`}>
                      {strengthLabel[strength]}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">Confirm Password</label>
                <input type={showPass ? "text" : "password"} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password" autoComplete="new-password"
                  className={`${inputCls} ${confirmPassword && confirmPassword !== password ? "!border-rose-300 focus:!ring-rose-300/40" : ""}`} />
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-rose-500 text-xs">Passwords do not match</p>
                )}
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  <p className="text-rose-600 text-xs">{error}</p>
                </div>
              )}

              <button type="submit"
                disabled={sending || !localPhone || !password || !confirmPassword || password !== confirmPassword}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] mt-1">
                {sending ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Sending code…
                  </>
                ) : (
                  <><MessageCircle size={15} /> Send Verification Code</>
                )}
              </button>

              <p className="text-center text-slate-400 text-xs pt-1">
                Already have an account?{" "}
                <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">Sign in</Link>
              </p>
            </form>
          )}

          {/* ── Step 2: OTP verify ── */}
          {step === "verify" && (
            <form onSubmit={handleVerify} className="bg-white border border-slate-200 rounded-3xl shadow-sm shadow-slate-200/60 p-8 space-y-5">
              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5">
                <MessageCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-emerald-700 text-sm font-semibold">Code sent via WhatsApp</p>
                  <p className="text-emerald-600/70 text-xs mt-0.5">
                    Sent to <span className="font-bold text-emerald-700">{masked}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">6-Digit Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  className={`${inputCls} tracking-[0.5em] font-bold text-center text-lg`}
                />
                <p className="text-slate-400 text-xs text-center">Expires in 15 minutes</p>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  <p className="text-rose-600 text-xs">{error}</p>
                </div>
              )}

              <button type="submit" disabled={submitting || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/20 active:scale-[0.98]">
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Creating account…
                  </>
                ) : (
                  <><span>Verify & Create Account</span> <ArrowRight size={14} /></>
                )}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button type="button"
                  onClick={() => { setStep("form"); setOtp(""); setError(""); }}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-600 text-xs transition-colors">
                  <ArrowLeft size={12} /> Edit details
                </button>
                <button type="button"
                  onClick={handleSendCode}
                  disabled={sending}
                  className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold transition-colors disabled:opacity-40">
                  {sending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
