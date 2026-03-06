"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
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

    const res = await fetch("/api/auth/register", {
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

    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-forest-900">Family Portal</h1>
          <p className="mt-2 text-forest-600">
            Lost Sierra Kids
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-paper-200 bg-white p-8 shadow-sm"
        >
          <h2 className="mb-6 text-xl font-semibold text-forest-900">
            Create Account
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="fullName"
              className="mb-1 block text-sm font-medium text-forest-800"
            >
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
            />
          </div>

          <div className="mb-4">
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
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
            />
          </div>

          <div className="mb-4">
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
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-forest-800"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-forest-800 px-4 py-2.5 font-medium text-white transition hover:bg-forest-700 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="mt-4 text-center text-sm text-forest-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-forest-800 underline hover:text-forest-600"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
