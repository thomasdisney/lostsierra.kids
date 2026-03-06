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
    <div className="relative flex min-h-screen items-center justify-center bg-paper-50 px-4 py-12">
      {/* Soft gradient wash */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(45,84,70,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/images/logo.png"
            alt="Lost Sierra Kids"
            width={72}
            height={72}
            className="mb-4 rounded-xl"
            style={{ width: 72, height: 72, objectFit: "contain" }}
          />
          <h1
            className="text-2xl font-bold tracking-tight text-forest-900"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Family Portal
          </h1>
          <p className="mt-1 text-sm text-forest-500">
            Lost Sierra Kids
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-paper-200 bg-white px-7 py-8 shadow-[0_1px_3px_rgba(30,58,47,0.06),0_8px_24px_rgba(30,58,47,0.04)]">
          <h2
            className="mb-1 text-lg font-semibold text-forest-900"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Create your account
          </h2>
          <p className="mb-6 text-sm text-forest-500">
            Join the enrollment waitlist for LSK programs
          </p>

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm leading-snug text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="fullName"
                className="mb-1 block text-sm font-medium text-forest-800"
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
                className="block w-full rounded-lg border border-paper-200 bg-paper-50 px-3.5 py-2.5 text-sm text-forest-900 outline-none transition placeholder:text-paper-300 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-100"
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-forest-800"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="block w-full rounded-lg border border-paper-200 bg-paper-50 px-3.5 py-2.5 text-sm text-forest-900 outline-none transition placeholder:text-paper-300 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-100"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-forest-800"
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
                className="block w-full rounded-lg border border-paper-200 bg-paper-50 px-3.5 py-2.5 text-sm text-forest-900 outline-none transition placeholder:text-paper-300 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-100"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-medium text-forest-800"
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
                className="block w-full rounded-lg border border-paper-200 bg-paper-50 px-3.5 py-2.5 text-sm text-forest-900 outline-none transition placeholder:text-paper-300 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-100"
                placeholder="Re-enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700 disabled:opacity-50"
            >
              {loading && (
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                />
              )}
              {loading ? "Creating account\u2026" : "Create Account"}
            </button>
          </form>
        </div>

        {/* Footer links */}
        <p className="mt-6 text-center text-sm text-forest-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-forest-800 underline decoration-forest-300 underline-offset-2 transition hover:decoration-forest-500"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-paper-300">
          <a
            href="https://lostsierrakids.com"
            className="transition hover:text-forest-500"
          >
            &larr; lostsierrakids.com
          </a>
        </p>
      </div>
    </div>
  );
}
