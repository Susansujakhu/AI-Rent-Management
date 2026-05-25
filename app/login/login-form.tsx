"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { COUNTRY_CODES, DEFAULT_CC } from "@/lib/country-codes";
import { Playfair_Display } from "next/font/google";

const serif = Playfair_Display({ weight: ["400", "700"], subsets: ["latin"] });

function Form() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/dashboard";
  const [countryCode, setCountryCode] = useState(DEFAULT_CC);
  const [localPhone,  setLocalPhone]  = useState("");
  const [password,    setPassword]    = useState("");
  const [show,        setShow]        = useState(false);
  const [error,       setError]       = useState("");
  const [phoneErr,    setPhoneErr]    = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [loading,     setLoading]     = useState(false);

  const fullPhone = `+${countryCode}${localPhone.replace(/\D/g, "")}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneErr("");
    setPasswordErr("");
    let valid = true;
    if (!localPhone.trim()) { setPhoneErr("Phone number is required"); valid = false; }
    if (!password) { setPasswordErr("Password is required"); valid = false; }
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, password }),
      });
      if (!res.ok) {
        setError("Incorrect phone number or password. Please try again.");
        setPassword("");
      } else {
        router.push(from);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f6]">

      {/* ── Left panel — dark brand ── */}
      <div className="hidden lg:flex lg:flex-[5] bg-slate-950 relative overflow-hidden items-center justify-center p-16">
        {/* Subtle glows */}
        <div className="pointer-events-none absolute top-1/4 -left-20 w-[500px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-amber-500/6 blur-[100px]" />

        <div className="relative z-10 max-w-md">
          {/* Brand — transparent with a thin white stroke so it floats on the gradient */}
          <div className="mb-14">
            <LogoMark size={56} tone="dark" />
          </div>

          <h2 className={`${serif.className} text-5xl text-white leading-[1.1] mb-5`}>
            Welcome back.<br />
            <span className="text-amber-400">Your properties</span><br />
            are waiting.
          </h2>
          <p className="text-white/40 text-base mb-12 leading-relaxed">
            Everything you need to collect rent on time — in one place.
          </p>

          {/* Feature list with amber checks */}
          <div className="space-y-4">
            {[
              "Track rent & utility payments",
              "Send WhatsApp reminders instantly",
              "Tenant self-service portal",
              "6-month collection reports",
            ].map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                  <Check size={10} className="text-amber-400" />
                </div>
                <span className="text-white/55 text-sm">{f}</span>
              </div>
            ))}
          </div>

          {/* Stat chips */}
          <div className="mt-12 grid grid-cols-3 gap-3">
            {[
              { value: "140+",   label: "Landlords" },
              { value: "₹18L+",  label: "Collected" },
              { value: "2,400+", label: "Bills sent" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.05] border border-white/[0.07] rounded-xl p-3.5">
                <div className="text-base font-bold text-white">{s.value}</div>
                <div className="text-white/30 text-[10px] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — light form ── */}
      <div className="w-full lg:flex-[4] min-h-screen flex items-center justify-center p-6 relative">
        {/* Back link */}
        <Link href="/"
          className="absolute top-5 left-5 z-20 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors group">
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        <div className="animate-scale-in relative z-10 w-full max-w-[400px]">
          <div className="text-center mb-8">
            {/* Logo visible on mobile only — sits on the white card */}
            <div className="flex justify-center mb-5 lg:hidden">
              <LogoMark size={56} tone="light" />
            </div>
            <h1 className={`${serif.className} text-[2rem] text-slate-900 mb-1`}>Sign in</h1>
            <p className="text-sm text-slate-400">Enter your phone number and password</p>
          </div>

          <form onSubmit={submit} className="bg-white border border-slate-200 rounded-3xl shadow-sm shadow-slate-200/60 p-8 space-y-5">

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">
                Phone Number
              </label>
              <div className={`flex rounded-xl overflow-hidden border transition-all focus-within:ring-2
                ${phoneErr
                  ? "border-rose-300 focus-within:ring-rose-300/40"
                  : "border-slate-200 focus-within:border-indigo-400 focus-within:ring-indigo-400/20"}`}>
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
                  onChange={e => { setLocalPhone(e.target.value.replace(/\D/g, "")); if (phoneErr) setPhoneErr(""); }}
                  placeholder="9866XXXXXX"
                  autoFocus
                  autoComplete="tel-national"
                  className="flex-1 bg-transparent px-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none"
                />
              </div>
              {phoneErr && <p className="text-rose-500 text-xs">{phoneErr}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">Password</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (passwordErr) setPasswordErr(""); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={`w-full bg-white border rounded-xl px-4 py-3.5 text-sm text-slate-800
                             placeholder:text-slate-300 focus:outline-none focus:ring-2 transition-all pr-12
                             ${passwordErr
                               ? "border-rose-300 focus:ring-rose-300/40"
                               : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20"}`}
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1">
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {passwordErr && <p className="text-rose-500 text-xs">{passwordErr}</p>}
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <Lock size={14} className="text-rose-500 mt-0.5 shrink-0" />
                <p className="text-rose-600 text-xs leading-relaxed">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-shimmer w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] mt-1">
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white/80" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <><span>Sign in</span> <ArrowRight size={14} /></>
              )}
            </button>
          </form>

          <div className="flex items-center justify-center gap-4 mt-5">
            <a href="/forgot-password" className="text-slate-400 hover:text-slate-600 text-xs transition-colors">
              Forgot password?
            </a>
            <span className="text-slate-200 text-xs">·</span>
            <a href="/signup" className="text-indigo-600 hover:text-indigo-700 font-semibold text-xs transition-colors">
              Create account
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginForm() {
  return <Suspense><Form /></Suspense>;
}
