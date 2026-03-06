"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      window.location.href = "/portal/dashboard";
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-paper-50 px-4">
      {/* Soft gradient wash behind the card */}
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
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm leading-snug text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                autoComplete="current-password"
                className="block w-full rounded-lg border border-paper-200 bg-paper-50 px-3.5 py-2.5 text-sm text-forest-900 outline-none transition placeholder:text-paper-300 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-100"
                placeholder="Enter your password"
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
              {loading ? "Signing in\u2026" : "Sign In"}
            </button>
          </form>
        </div>

        {/* Footer links */}
        <p className="mt-6 text-center text-sm text-forest-600">
          New here?{" "}
          <Link
            href="/register"
            className="font-semibold text-forest-800 underline decoration-forest-300 underline-offset-2 transition hover:decoration-forest-500"
          >
            Create an account
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
