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
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Left brand panel — hidden on mobile */}
      <div
        style={{
          flex: "0 0 420px",
          background: "linear-gradient(165deg, #1e3a2f 0%, #2d5446 50%, #3a6858 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "3rem 2.5rem",
          position: "relative",
          overflow: "hidden",
        }}
        className="hidden lg:flex"
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            right: "-80px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            border: "1px solid rgba(232,196,108,0.1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-120px",
            left: "-60px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <img
            src="/images/logo.png"
            alt="Lost Sierra Kids"
            style={{
              width: "100px",
              height: "100px",
              objectFit: "contain",
              borderRadius: "16px",
              marginBottom: "2rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          />

          <h2
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.3,
              marginBottom: "0.75rem",
            }}
          >
            Family Portal
          </h2>

          <p
            style={{
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: "0.95rem",
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.6,
              maxWidth: "280px",
            }}
          >
            Manage your family&apos;s enrollment for Lost Sierra Kids programs in Graeagle, CA
          </p>

          <div
            style={{
              marginTop: "2.5rem",
              padding: "1rem 1.5rem",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <p
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "0.85rem",
                color: "#e8c46c",
                fontStyle: "italic",
                lineHeight: 1.5,
              }}
            >
              &ldquo;Growing together in the Sierra&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "2rem 1.5rem",
          backgroundColor: "#faf8f5",
        }}
      >
        <div style={{ width: "100%", maxWidth: "380px" }}>
          {/* Mobile-only logo */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <img
              src="/images/logo.png"
              alt="Lost Sierra Kids"
              style={{
                width: "64px",
                height: "64px",
                objectFit: "contain",
                borderRadius: "12px",
                marginBottom: "1rem",
              }}
            />
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#1e3a2f",
              }}
            >
              Family Portal
            </h1>
            <p style={{ fontSize: "0.85rem", color: "#4a7c67", marginTop: "0.25rem" }}>
              Lost Sierra Kids
            </p>
          </div>

          {/* Form header */}
          <div style={{ marginBottom: "2rem" }}>
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "1.65rem",
                fontWeight: 700,
                color: "#1e3a2f",
                marginBottom: "0.5rem",
              }}
            >
              Welcome back
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#4a7c67" }}>
              Sign in to your family account
            </p>
          </div>

          {/* Error */}
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

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#2d5446",
                  marginBottom: "0.4rem",
                }}
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
                style={{
                  width: "100%",
                  padding: "0.7rem 0.9rem",
                  fontSize: "0.9rem",
                  fontFamily: "'Source Sans 3', sans-serif",
                  color: "#1e3a2f",
                  backgroundColor: "#fff",
                  border: "1.5px solid #ebe5db",
                  borderRadius: "10px",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#5e9a7f";
                  e.target.style.boxShadow = "0 0 0 3px rgba(94,154,127,0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#ebe5db";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div style={{ marginBottom: "1.75rem" }}>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#2d5446",
                  marginBottom: "0.4rem",
                }}
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
                placeholder="Enter your password"
                style={{
                  width: "100%",
                  padding: "0.7rem 0.9rem",
                  fontSize: "0.9rem",
                  fontFamily: "'Source Sans 3', sans-serif",
                  color: "#1e3a2f",
                  backgroundColor: "#fff",
                  border: "1.5px solid #ebe5db",
                  borderRadius: "10px",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#5e9a7f";
                  e.target.style.boxShadow = "0 0 0 3px rgba(94,154,127,0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#ebe5db";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "0.9rem",
                fontWeight: 700,
                fontFamily: "'Source Sans 3', sans-serif",
                color: "#fff",
                backgroundColor: loading ? "#3a6858" : "#2d5446",
                border: "none",
                borderRadius: "10px",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background-color 0.15s, transform 0.1s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                opacity: loading ? 0.7 : 1,
              }}
              onMouseOver={(e) => {
                if (!loading) (e.target as HTMLElement).style.backgroundColor = "#1e3a2f";
              }}
              onMouseOut={(e) => {
                if (!loading) (e.target as HTMLElement).style.backgroundColor = "#2d5446";
              }}
            >
              {loading && (
                <span
                  style={{
                    display: "inline-block",
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
              )}
              {loading ? "Signing in\u2026" : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              margin: "1.75rem 0",
            }}
          >
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ebe5db" }} />
            <span style={{ fontSize: "0.75rem", color: "#d9d0c3" }}>or</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ebe5db" }} />
          </div>

          {/* Create account link */}
          <p style={{ textAlign: "center", fontSize: "0.9rem", color: "#4a7c67" }}>
            New to Lost Sierra Kids?{" "}
            <Link
              href="/register"
              style={{
                color: "#2d5446",
                fontWeight: 700,
                textDecoration: "underline",
                textUnderlineOffset: "3px",
                textDecorationColor: "#a3d1b9",
              }}
            >
              Create an account
            </Link>
          </p>

          {/* Back link */}
          <p
            style={{
              textAlign: "center",
              fontSize: "0.8rem",
              color: "#d9d0c3",
              marginTop: "2rem",
            }}
          >
            <a
              href="https://lostsierrakids.com"
              style={{
                color: "inherit",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              onMouseOver={(e) => { (e.target as HTMLElement).style.color = "#4a7c67"; }}
              onMouseOut={(e) => { (e.target as HTMLElement).style.color = "#d9d0c3"; }}
            >
              &larr; Back to lostsierrakids.com
            </a>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
