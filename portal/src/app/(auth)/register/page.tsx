"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const res = await fetch("/portal/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, confirmPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    window.location.href = "/portal/login";
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper-50 px-4 py-12">
      {/* Decorative top bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-forest-800 via-forest-600 to-gold-500" />

      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-800 shadow-lg">
            <svg className="h-8 w-8 text-gold-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3L4 9v12h16V9l-8-6z" />
              <path d="M9 21V13h6v8" />
              <path d="M3 9l9-6 9 6" />
            </svg>
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-forest-900">
            Family Portal
          </h1>
          <p className="mt-2 text-sm text-forest-600">
            Lost Sierra Kids &middot; Graeagle, CA
          </p>
        </div>

        {/* Register Card */}
        <div className="rounded-2xl border border-paper-200 bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-forest-900">
            Create your account
          </h2>
          <p className="mb-6 text-sm text-forest-500">
            Join the enrollment waitlist for Lost Sierra Kids programs
          </p>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="fullName"
                className="mb-1.5 block text-sm font-medium text-forest-800"
              >
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Jane Smith"
                className="w-full rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-sm text-forest-900 outline-none transition placeholder:text-paper-300 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-100"
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-forest-800"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-sm text-forest-900 outline-none transition placeholder:text-paper-300 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-100"
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-forest-800"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="w-full rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-sm text-forest-900 outline-none transition placeholder:text-paper-300 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-100"
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-forest-800"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                className="w-full rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-sm text-forest-900 outline-none transition placeholder:text-paper-300 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-forest-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-paper-200" />
            <span className="text-xs text-paper-300">or</span>
            <div className="h-px flex-1 bg-paper-200" />
          </div>

          <p className="mt-5 text-center text-sm text-forest-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-forest-800 transition hover:text-forest-600"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-paper-300">
          <a
            href="https://lostsierrakids.com"
            className="transition hover:text-forest-600"
          >
            &larr; Back to lostsierrakids.com
          </a>
        </p>
      </div>
    </div>
  );
}
