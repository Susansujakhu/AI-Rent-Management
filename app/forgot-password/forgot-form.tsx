"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, ArrowLeft, Mail, KeyRound, MessageCircle } from "lucide-react";
import Link from "next/link";

type Step = "request" | "reset" | "done";

export function ForgotPasswordForm() {
  const router   = useRouter();
  const [step,            setStep]            = useState<Step>("request");
  // Step 1
  const [email,           setEmail]           = useState("");
  const [requesting,      setRequesting]      = useState(false);
  const [requestError,    setRequestError]    = useState("");
  const [sentInfo,        setSentInfo]        = useState<{ sent: boolean; masked: string | null } | null>(null);
  // Step 2
  const [otp,             setOtp]             = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass,        setShowPass]        = useState(false);
  const [resetting,       setResetting]       = useState(false);
  const [resetError,      setResetError]      = useState("");

  const inputCls = "w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400/70 focus:border-violet-400/50 transition-all";

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setRequesting(true);
    setRequestError("");
    try {
      const res  = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json() as { ok?: boolean; sent?: boolean; masked?: string | null; error?: string };
      if (!res.ok) { setRequestError(data.error ?? "Something went wrong."); return; }
      setSentInfo({ sent: data.sent ?? false, masked: data.masked ?? null });
      setStep("reset");
    } catch {
      setRequestError("Something went wrong. Try again.");
    } finally {
      setRequesting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) { setResetError("Passwords do not match."); return; }
    if (newPassword.length < 6) { setResetError("Password must be at least 6 characters."); return; }
    setResetting(true);
    setResetError("");
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setResetError(data.error ?? "Something went wrong."); return; }
      setStep("done");
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setResetError("Something went wrong. Try again.");
    } finally {
      setResetting(false);
    }
  };

  const strength = newPassword.length === 0 ? 0 : newPassword.length < 6 ? 1 : newPassword.length < 10 ? 2 : 3;
  const strengthColor = ["", "bg-rose-500", "bg-amber-400", "bg-emerald-500"];
  const strengthLabel = ["", "Weak", "Good", "Strong"];

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#0f0f1a]">
      <div className="animate-blob-1 pointer-events-none absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-violet-600/30 blur-[110px]" />
      <div className="animate-blob-2 pointer-events-none absolute -bottom-40 -right-20 w-[480px] h-[480px] rounded-full bg-indigo-600/25 blur-[120px]" />
      <div className="animate-blob-3 pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-blue-500/15 blur-[90px]" />

      <div className="animate-scale-in relative z-10 w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-400 to-indigo-700 flex items-center justify-center mx-auto mb-5 shadow-[0_0_40px_rgba(139,92,246,0.55),0_8px_32px_rgba(0,0,0,0.4)]">
            <Building2 size={34} className="text-white drop-shadow" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Rent Manager</h1>
          <p className="text-sm text-white/50 mt-1.5 font-medium">
            {step === "request" && "Reset your password"}
            {step === "reset"   && "Enter your reset code"}
            {step === "done"    && "Password updated!"}
          </p>
        </div>

        {/* ── Step 1: Request ── */}
        {step === "request" && (
          <form onSubmit={handleRequest} className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 shadow-[0_32px_64px_rgba(0,0,0,0.5)] p-8 space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">Email address</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"><Mail size={15} /></div>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoFocus autoComplete="email"
                  className={`${inputCls} pl-10`} />
              </div>
              <p className="text-white/30 text-xs">We&apos;ll send a 6-digit code to your registered phone via WhatsApp.</p>
            </div>

            {requestError && (
              <div className="bg-rose-500/15 border border-rose-400/25 rounded-xl px-4 py-3">
                <p className="text-rose-300 text-xs">{requestError}</p>
              </div>
            )}

            <button type="submit" disabled={requesting || !email}
              className="w-full bg-gradient-to-r from-violet-500 via-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl text-sm font-semibold hover:from-violet-400 hover:via-indigo-500 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_rgba(139,92,246,0.45)] active:scale-[0.98]">
              {requesting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Sending…
                </span>
              ) : "Send Reset Code"}
            </button>

            <p className="text-center text-white/35 text-xs pt-1">
              <Link href="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors flex items-center justify-center gap-1">
                <ArrowLeft size={12} /> Back to sign in
              </Link>
            </p>
          </form>
        )}

        {/* ── Step 2: Enter OTP + new password ── */}
        {step === "reset" && (
          <form onSubmit={handleReset} className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 shadow-[0_32px_64px_rgba(0,0,0,0.5)] p-8 space-y-4">

            {/* Delivery status */}
            {sentInfo?.sent && (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-xs bg-emerald-500/15 border border-emerald-400/25">
                <MessageCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-emerald-300">Code sent to <span className="font-bold">{sentInfo.masked}</span> via WhatsApp.</p>
              </div>
            )}

            {/* OTP */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">6-digit Reset Code</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"><KeyRound size={15} /></div>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" inputMode="numeric" autoFocus maxLength={6}
                  className={`${inputCls} pl-10 tracking-[0.4em] font-bold`} />
              </div>
            </div>

            {/* New password */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">New Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters" autoComplete="new-password"
                  className={`${inputCls} pr-12`} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors p-1">
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {newPassword.length > 0 && (
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

            {/* Confirm */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">Confirm Password</label>
              <input type={showPass ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password" autoComplete="new-password"
                className={`${inputCls} ${confirmPassword && confirmPassword !== newPassword ? "!border-rose-400/50 focus:!ring-rose-400/70" : ""}`} />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-rose-400 text-xs">Passwords do not match</p>
              )}
            </div>

            {resetError && (
              <div className="bg-rose-500/15 border border-rose-400/25 rounded-xl px-4 py-3">
                <p className="text-rose-300 text-xs">{resetError}</p>
              </div>
            )}

            <button type="submit"
              disabled={resetting || otp.length !== 6 || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="w-full bg-gradient-to-r from-violet-500 via-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl text-sm font-semibold hover:from-violet-400 hover:via-indigo-500 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_rgba(139,92,246,0.45)] active:scale-[0.98]">
              {resetting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Resetting…
                </span>
              ) : "Reset Password"}
            </button>

            <button type="button" onClick={() => { setStep("request"); setOtp(""); setNewPassword(""); setConfirmPassword(""); }}
              className="w-full text-center text-white/35 text-xs flex items-center justify-center gap-1 hover:text-white/60 transition-colors">
              <ArrowLeft size={12} /> Try a different email
            </button>
          </form>
        )}

        {/* ── Step 3: Done ── */}
        {step === "done" && (
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 shadow-[0_32px_64px_rgba(0,0,0,0.5)] p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-lg">Password updated!</p>
              <p className="text-white/50 text-sm mt-1">All sessions have been signed out. Redirecting to login…</p>
            </div>
            <Link href="/login" className="block text-violet-400 hover:text-violet-300 text-sm font-semibold transition-colors">
              Sign in now →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
