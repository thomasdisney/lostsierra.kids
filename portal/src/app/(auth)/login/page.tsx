"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) { setError("Invalid email or password"); setLoading(false); return; }
      if (result?.ok) { window.location.href = "/portal/dashboard"; return; }
      setError("Sign in failed. Please try again.");
      setLoading(false);
    } catch (err) {
      setError(`Connection error: ${err instanceof Error ? err.message : "Please try again."}`);
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-xl border-[1.5px] border-paper-300 bg-white px-4 py-3 text-base text-forest-900 outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200";

  return (
    <div className="flex min-h-[100dvh]">
      {/* Brand panel — desktop only */}
      <div className="hidden w-[420px] flex-col items-center justify-center bg-gradient-to-br from-forest-900 via-forest-800 to-forest-700 lg:flex">
        <img src="/images/logo.png" alt="Lost Sierra Kids" className="h-40 w-40 rounded-2xl bg-white object-contain p-3 shadow-2xl" />
      </div>

      {/* Form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-paper-50 px-6 py-10">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="mb-6 flex justify-center lg:hidden">
            <img src="/images/logo.png" alt="Lost Sierra Kids" className="h-16 w-16 rounded-xl bg-white object-contain p-1.5 shadow-md" />
          </div>

          <h1 className="mb-1 font-serif text-2xl font-bold text-forest-900">Welcome back</h1>
          <p className="mb-6 text-sm text-forest-600">Sign in to your family account</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="mb-1 block text-sm font-semibold text-forest-700">Email address</label>
              <input id="email" type="text" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="Email or username" className={inputCls} />
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="mb-1 block text-sm font-semibold text-forest-700">Password</label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter your password" className={`${inputCls} pr-14`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-forest-600" tabIndex={-1}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-4 py-3 text-base font-bold text-white transition active:bg-forest-900 disabled:opacity-60">
              {loading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {loading ? "Signing in\u2026" : "Sign In"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-paper-300" />
            <span className="text-xs text-paper-400">or</span>
            <div className="h-px flex-1 bg-paper-300" />
          </div>

          <Link href="/portal/register" className="block w-full rounded-xl border-[1.5px] border-paper-300 bg-transparent px-4 py-3 text-center text-base font-bold text-forest-700 transition active:bg-paper-100">
            Create an account
          </Link>

          <p className="mt-8 text-center text-xs text-paper-400">
            <a href="https://lostsierrakids.com" className="transition hover:text-forest-600">&larr; Back to lostsierrakids.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
