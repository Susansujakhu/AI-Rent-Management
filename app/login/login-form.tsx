"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, Building2 } from "lucide-react";
import { Suspense } from "react";
import { COUNTRY_CODES, DEFAULT_CC } from "@/lib/country-codes";

function Form() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";
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
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#0f0f1a]">
      <div className="animate-blob-1 pointer-events-none absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-indigo-600/30 blur-[110px]" />
      <div className="animate-blob-2 pointer-events-none absolute -bottom-40 -right-20 w-[480px] h-[480px] rounded-full bg-violet-600/25 blur-[120px]" />
      <div className="animate-blob-3 pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-blue-500/15 blur-[90px]" />

      <div className="animate-scale-in relative z-10 w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center mx-auto mb-5 shadow-[0_0_40px_rgba(99,102,241,0.55),0_8px_32px_rgba(0,0,0,0.4)]">
            <Building2 size={34} className="text-white drop-shadow" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Rent Manager</h1>
          <p className="text-sm text-white/50 mt-1.5 font-medium">Sign in to your workspace</p>
        </div>

        <form onSubmit={submit} className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 shadow-[0_32px_64px_rgba(0,0,0,0.5)] p-8 space-y-5">

          {/* Phone with country code */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">
              Phone Number
            </label>
            <div className={`flex rounded-xl overflow-hidden border focus-within:ring-2 transition-all
              ${phoneErr ? "border-rose-400/60 focus-within:ring-rose-400/50" : "border-white/15 focus-within:ring-indigo-400/70 focus-within:border-indigo-400/50"}`}>
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
                onChange={e => { setLocalPhone(e.target.value.replace(/\D/g, "")); if (phoneErr) setPhoneErr(""); }}
                placeholder="9866XXXXXX"
                autoFocus
                autoComplete="tel-national"
                className="flex-1 bg-transparent px-4 py-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
              />
            </div>
            {phoneErr && <p className="text-rose-400 text-xs">{phoneErr}</p>}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">Password</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); if (passwordErr) setPasswordErr(""); }}
                placeholder="Enter your password"
                autoComplete="current-password"
                className={`w-full bg-white/8 border rounded-xl px-4 py-3.5 text-sm text-white
                           placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all pr-12
                           ${passwordErr ? "border-rose-400/60 focus:ring-rose-400/50" : "border-white/15 focus:ring-indigo-400/70 focus:border-indigo-400/50"}`}
              />
              <button type="button" onClick={() => setShow(!show)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors p-1">
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {passwordErr && <p className="text-rose-400 text-xs">{passwordErr}</p>}
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-rose-500/15 border border-rose-400/25 rounded-xl px-4 py-3">
              <Lock size={14} className="text-rose-400 mt-0.5 shrink-0" />
              <p className="text-rose-300 text-xs leading-relaxed">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="btn-shimmer w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl text-sm font-semibold hover:from-indigo-400 hover:via-indigo-500 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_4px_20px_rgba(99,102,241,0.45)] hover:shadow-[0_6px_28px_rgba(99,102,241,0.6)] active:scale-[0.98] mt-1">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white/80" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Signing in…
              </span>
            ) : "Sign in"}
          </button>
        </form>

        <div className="flex items-center justify-center gap-4 mt-6">
          <a href="/forgot-password" className="text-white/30 hover:text-white/60 text-xs transition-colors">
            Forgot password?
          </a>
          <span className="text-white/15 text-xs">·</span>
          <a href="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold text-xs transition-colors">
            Create account
          </a>
        </div>
      </div>
    </div>
  );
}

export function LoginForm() {
  return <Suspense><Form /></Suspense>;
}
