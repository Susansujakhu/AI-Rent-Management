"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, MessageCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { COUNTRY_CODES, DEFAULT_CC } from "@/lib/country-codes";

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

  const inputCls = "w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400/70 focus:border-violet-400/50 transition-all";
  const fullPhone = `+${countryCode}${localPhone.replace(/\D/g, "")}`;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address"); return; }
    if (!password) { setError("Password is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!localPhone.trim()) { setError("Phone number is required"); return; }

    setSending(true);
    try {
      const res  = await fetch("/api/auth/send-phone-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: fullPhone, email: email.trim() || undefined }),
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
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const strength      = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabel = ["", "Weak", "Good", "Strong"];
  const strengthColor = ["", "bg-rose-500", "bg-amber-400", "bg-emerald-500"];

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#0f0f1a]">
      <div className="animate-blob-1 pointer-events-none absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-violet-600/30 blur-[110px]" />
      <div className="animate-blob-2 pointer-events-none absolute -bottom-40 -right-20 w-[480px] h-[480px] rounded-full bg-indigo-600/25 blur-[120px]" />
      <div className="animate-blob-3 pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-blue-500/15 blur-[90px]" />

      <div className="animate-scale-in relative z-10 w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-400 to-indigo-700 flex items-center justify-center mx-auto mb-5 shadow-[0_0_40px_rgba(139,92,246,0.55),0_8px_32px_rgba(0,0,0,0.4)]">
            <Building2 size={34} className="text-white drop-shadow" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Rent Manager</h1>
          <p className="text-sm text-white/50 mt-1.5 font-medium">
            {step === "form" ? "Create your account" : "Verify your phone"}
          </p>
        </div>

        {/* ── Step 1: Fill form ── */}
        {step === "form" && (
          <form onSubmit={handleSendCode} className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 shadow-[0_32px_64px_rgba(0,0,0,0.5)] p-8 space-y-4">

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">
                Name <span className="normal-case font-normal text-white/35">(optional)</span>
              </label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" autoFocus autoComplete="name" className={inputCls} />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">
                Email <span className="normal-case font-normal text-white/35">(optional)</span>
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" className={inputCls} />
            </div>

            {/* Phone with country code */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">
                Phone Number <span className="text-rose-400 normal-case font-normal">*</span>
              </label>
              <div className="flex rounded-xl overflow-hidden border border-white/15 focus-within:ring-2 focus-within:ring-violet-400/70 focus-within:border-violet-400/50 transition-all">
                <select
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value)}
                  className="bg-white/15 text-white text-sm px-3 py-3.5 border-r border-white/15 focus:outline-none cursor-pointer shrink-0"
                  style={{ maxWidth: "90px" }}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code} style={{ background: "#1e1b4b" }}>
                      +{c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={localPhone}
                  onChange={e => setLocalPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="9866XXXXXX"
                  autoComplete="tel-national"
                  className="flex-1 bg-transparent px-4 py-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
              </div>
              <p className="text-white/30 text-xs">A WhatsApp verification code will be sent to this number.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters" autoComplete="new-password"
                  className={`${inputCls} pr-12`} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors p-1">
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${strength >= i ? strengthColor[strength] : "bg-white/15"}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${strength === 1 ? "text-rose-400" : strength === 2 ? "text-amber-400" : "text-emerald-400"}`}>
                    {strengthLabel[strength]}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">Confirm Password</label>
              <input type={showPass ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password" autoComplete="new-password"
                className={`${inputCls} ${confirmPassword && confirmPassword !== password ? "!border-rose-400/50 focus:!ring-rose-400/70" : ""}`} />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-rose-400 text-xs">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="bg-rose-500/15 border border-rose-400/25 rounded-xl px-4 py-3">
                <p className="text-rose-300 text-xs">{error}</p>
              </div>
            )}

            <button type="submit"
              disabled={sending || !localPhone || !password || !confirmPassword || password !== confirmPassword}
              className="w-full bg-gradient-to-r from-violet-500 via-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl text-sm font-semibold hover:from-violet-400 hover:via-indigo-500 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_rgba(139,92,246,0.45)] active:scale-[0.98] mt-1">
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Sending code…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <MessageCircle size={15} /> Send Verification Code
                </span>
              )}
            </button>

            <p className="text-center text-white/35 text-xs pt-1">
              Already have an account?{" "}
              <Link href="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">Sign in</Link>
            </p>
          </form>
        )}

        {/* ── Step 2: Enter OTP ── */}
        {step === "verify" && (
          <form onSubmit={handleVerify} className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 shadow-[0_32px_64px_rgba(0,0,0,0.5)] p-8 space-y-5">
            <div className="flex items-start gap-3 bg-emerald-500/15 border border-emerald-400/25 rounded-xl px-4 py-3.5">
              <MessageCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-emerald-300 text-sm font-semibold">Code sent via WhatsApp</p>
                <p className="text-emerald-400/70 text-xs mt-0.5">
                  Sent to <span className="font-bold text-emerald-300">{masked}</span>. Check your WhatsApp messages.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">6-Digit Code</label>
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
              <p className="text-white/30 text-xs text-center">Expires in 15 minutes</p>
            </div>

            {error && (
              <div className="bg-rose-500/15 border border-rose-400/25 rounded-xl px-4 py-3">
                <p className="text-rose-300 text-xs">{error}</p>
              </div>
            )}

            <button type="submit" disabled={submitting || otp.length !== 6}
              className="w-full bg-gradient-to-r from-violet-500 via-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl text-sm font-semibold hover:from-violet-400 hover:via-indigo-500 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_rgba(139,92,246,0.45)] active:scale-[0.98]">
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Creating account…
                </span>
              ) : "Verify & Create Account"}
            </button>

            <div className="flex items-center justify-between pt-1">
              <button type="button"
                onClick={() => { setStep("form"); setOtp(""); setError(""); }}
                className="flex items-center gap-1 text-white/35 hover:text-white/60 text-xs transition-colors">
                <ArrowLeft size={12} /> Edit details
              </button>
              <button type="button"
                onClick={handleSendCode}
                disabled={sending}
                className="text-violet-400 hover:text-violet-300 text-xs font-semibold transition-colors disabled:opacity-40">
                {sending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
