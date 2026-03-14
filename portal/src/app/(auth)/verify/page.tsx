"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/portal/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailParam, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Verification failed"); setLoading(false); return; }
      setSuccess(true);
      setTimeout(async () => {
        await signOut({ redirect: false }).catch(() => {});
        window.location.href = "/portal/login";
      }, 2000);
    } catch {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResent(false);
    setError("");
    try {
      const res = await fetch("/portal/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailParam }),
      });
      if (res.ok) { setResent(true); }
      else { const data = await res.json(); setError(data.error || "Failed to resend code"); }
    } catch { setError("Connection error"); }
    setResending(false);
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper-50 px-6 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-3xl">
            &#9993;
          </div>
          <h1 className="mb-1 font-serif text-2xl font-bold text-forest-900">Check your email</h1>
          <p className="text-sm text-forest-600">
            We sent a 6-digit code to <strong className="text-forest-800">{emailParam}</strong>
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {success ? (
          <div className="rounded-xl bg-green-50 p-6 text-center">
            <div className="mb-2 text-2xl">&#10003;</div>
            <p className="font-bold text-forest-900">Email verified!</p>
            <p className="mt-1 text-sm text-forest-600">Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="w-full rounded-xl border-[1.5px] border-paper-300 bg-white px-4 py-4 text-center text-2xl font-bold tracking-[0.3em] text-forest-900 outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-xl bg-forest-800 px-4 py-3 text-base font-bold text-white transition active:bg-forest-900 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>

            <div className="mt-5 text-center">
              {resent ? (
                <p className="text-sm font-medium text-forest-700">New code sent!</p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm text-forest-600 underline"
                >
                  {resending ? "Sending..." : "Didn't get the code? Resend"}
                </button>
              )}
            </div>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-paper-400">
          <a href="/portal/login" className="transition hover:text-forest-600">&larr; Back to login</a>
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-paper-50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-paper-300 border-t-forest-600" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
