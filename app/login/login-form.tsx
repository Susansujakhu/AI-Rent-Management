"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, Building2 } from "lucide-react";
import { Suspense } from "react";

function Form() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Incorrect email or password. Please try again.");
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
    /* ── Full-screen gradient stage ── */
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#0f0f1a]">

      {/* Animated ambient blobs */}
      <div
        className="animate-blob-1 pointer-events-none absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full
                   bg-indigo-600/30 blur-[110px]"
      />
      <div
        className="animate-blob-2 pointer-events-none absolute -bottom-40 -right-20 w-[480px] h-[480px] rounded-full
                   bg-violet-600/25 blur-[120px]"
      />
      <div
        className="animate-blob-3 pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-[340px] h-[340px] rounded-full bg-blue-500/15 blur-[90px]"
      />

      {/* Frosted card */}
      <div className="animate-scale-in relative z-10 w-full max-w-[420px]">
        {/* Logo block */}
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-400 to-indigo-700
                       flex items-center justify-center mx-auto mb-5
                       shadow-[0_0_40px_rgba(99,102,241,0.55),0_8px_32px_rgba(0,0,0,0.4)]"
          >
            <Building2 size={34} className="text-white drop-shadow" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Rent Manager</h1>
          <p className="text-sm text-white/50 mt-1.5 font-medium">Sign in to your workspace</p>
        </div>

        {/* Form card */}
        <form
          onSubmit={submit}
          className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15
                     shadow-[0_32px_64px_rgba(0,0,0,0.5)] p-8 space-y-5"
        >
          {/* Email */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              autoComplete="email"
              className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3.5 text-sm text-white
                         placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400/70
                         focus:border-indigo-400/50 transition-all"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">
              Password
            </label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3.5 text-sm text-white
                           placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400/70
                           focus:border-indigo-400/50 transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors p-1"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2.5 bg-rose-500/15 border border-rose-400/25 rounded-xl px-4 py-3">
              <Lock size={14} className="text-rose-400 mt-0.5 shrink-0" />
              <p className="text-rose-300 text-xs leading-relaxed">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="btn-shimmer w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700
                       text-white py-3.5 rounded-xl text-sm font-semibold
                       hover:from-indigo-400 hover:via-indigo-500 hover:to-indigo-600
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-200
                       shadow-[0_4px_20px_rgba(99,102,241,0.45)]
                       hover:shadow-[0_6px_28px_rgba(99,102,241,0.6)]
                       active:scale-[0.98] mt-1"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white/80" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Footer note */}
        <p className="text-center text-white/30 text-xs mt-6">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export function LoginForm() {
  return <Suspense><Form /></Suspense>;
}
