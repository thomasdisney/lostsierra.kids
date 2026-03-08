"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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

      if (!res.ok) {
        setError(data.error || "Verification failed");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
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

      if (res.ok) {
        setResent(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to resend code");
      }
    } catch {
      setError("Connection error");
    }
    setResending(false);
  }

  const inputBase: React.CSSProperties = {
    width: "100%",
    padding: "1rem",
    fontSize: "1.5rem",
    fontFamily: "'Source Sans 3', sans-serif",
    color: "#1e3a2f",
    backgroundColor: "#fff",
    border: "1.5px solid #ebe5db",
    borderRadius: "10px",
    outline: "none",
    textAlign: "center",
    letterSpacing: "0.3em",
    fontWeight: 700,
    boxSizing: "border-box" as const,
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#faf8f5",
        padding: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              backgroundColor: "#e8f5e9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              fontSize: "1.75rem",
            }}
          >
            &#9993;
          </div>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "1.65rem",
              fontWeight: 700,
              color: "#1e3a2f",
              marginBottom: "0.5rem",
            }}
          >
            Check your email
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#4a7c67" }}>
            We sent a 6-digit code to{" "}
            <strong>{emailParam}</strong>
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "0.75rem 1rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              fontSize: "0.875rem",
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        )}

        {success ? (
          <div
            style={{
              padding: "1.5rem",
              backgroundColor: "#e8f5e9",
              borderRadius: "12px",
              textAlign: "center",
              color: "#1e3a2f",
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              &#10003;
            </div>
            <strong>Email verified!</strong>
            <p style={{ fontSize: "0.85rem", color: "#4a7c67", marginTop: "0.25rem" }}>
              Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1.5rem" }}>
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                maxLength={6}
                style={inputBase}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "0.9rem",
                fontWeight: 700,
                fontFamily: "'Source Sans 3', sans-serif",
                color: "#fff",
                backgroundColor:
                  loading || code.length !== 6 ? "#3a6858" : "#2d5446",
                border: "none",
                borderRadius: "10px",
                cursor:
                  loading || code.length !== 6 ? "not-allowed" : "pointer",
                opacity: loading || code.length !== 6 ? 0.7 : 1,
              }}
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>

            <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
              {resent ? (
                <p style={{ fontSize: "0.85rem", color: "#2d5446" }}>
                  New code sent!
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "0.85rem",
                    color: "#4a7c67",
                    cursor: "pointer",
                    fontFamily: "'Source Sans 3', sans-serif",
                    textDecoration: "underline",
                  }}
                >
                  {resending ? "Sending..." : "Didn't get the code? Resend"}
                </button>
              )}
            </div>
          </form>
        )}

        <p
          style={{
            textAlign: "center",
            fontSize: "0.8rem",
            color: "#d9d0c3",
            marginTop: "2rem",
          }}
        >
          <a
            href="/portal/login"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            &larr; Back to login
          </a>
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#faf8f5",
          }}
        >
          <div style={{ color: "#4a7c67" }}>Loading...</div>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
