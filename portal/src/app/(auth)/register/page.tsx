"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

    try {
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
    } catch (err) {
      setError(`Connection error: ${err instanceof Error ? err.message : "Please try again."}`);
      setLoading(false);
    }
  }

  const inputBase: React.CSSProperties = {
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
    boxSizing: "border-box" as const,
  };

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = "#5e9a7f";
    e.target.style.boxShadow = "0 0 0 3px rgba(94,154,127,0.12)";
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = "#ebe5db";
    e.target.style.boxShadow = "none";
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Left brand panel — desktop only */}
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
        <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "300px", height: "300px", borderRadius: "50%", border: "1px solid rgba(232,196,108,0.1)" }} />
        <div style={{ position: "absolute", bottom: "-120px", left: "-60px", width: "400px", height: "400px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)" }} />

        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <img
            src="/images/logo.png"
            alt="Lost Sierra Kids"
            style={{
              width: "160px",
              height: "160px",
              objectFit: "contain",
              borderRadius: "20px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
            }}
          />
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
          overflowY: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: "380px" }}>
          {/* Mobile-only title */}
          <div className="mb-6 lg:hidden" style={{ textAlign: "center" }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.5rem", fontWeight: 700, color: "#1e3a2f" }}>
              Lost Sierra Kids
            </h1>
            <p style={{ fontSize: "0.85rem", color: "#4a7c67", marginTop: "0.25rem" }}>Family Portal</p>
          </div>

          {/* Form header */}
          <div style={{ marginBottom: "1.75rem" }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.65rem", fontWeight: 700, color: "#1e3a2f", marginBottom: "0.5rem" }}>
              Create your account
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#4a7c67" }}>
              Join the enrollment waitlist for LSK programs
            </p>
          </div>

          {error && (
            <div style={{
              marginBottom: "1.5rem",
              padding: "0.75rem 1rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              fontSize: "0.875rem",
              color: "#b91c1c",
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="fullName" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#2d5446", marginBottom: "0.4rem" }}>
                Full name
              </label>
              <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" placeholder="Jane Smith" style={inputBase} onFocus={handleFocus} onBlur={handleBlur} />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="email" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#2d5446", marginBottom: "0.4rem" }}>
                Email address
              </label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" style={inputBase} onFocus={handleFocus} onBlur={handleBlur} />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="password" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#2d5446", marginBottom: "0.4rem" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  style={{ ...inputBase, paddingRight: "3rem" }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: "0.35rem",
                    color: "#4a7c67", fontSize: "0.75rem", fontWeight: 600, fontFamily: "'Source Sans 3', sans-serif",
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "1.75rem" }}>
              <label htmlFor="confirmPassword" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#2d5446", marginBottom: "0.4rem" }}>
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                style={inputBase}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "0.75rem", fontSize: "0.9rem", fontWeight: 700,
                fontFamily: "'Source Sans 3', sans-serif", color: "#fff",
                backgroundColor: loading ? "#3a6858" : "#2d5446", border: "none", borderRadius: "10px",
                cursor: loading ? "not-allowed" : "pointer", transition: "background-color 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                opacity: loading ? 0.7 : 1,
              }}
              onMouseOver={(e) => { if (!loading) (e.target as HTMLElement).style.backgroundColor = "#1e3a2f"; }}
              onMouseOut={(e) => { if (!loading) (e.target as HTMLElement).style.backgroundColor = "#2d5446"; }}
            >
              {loading && (
                <span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              )}
              {loading ? "Creating account\u2026" : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.75rem 0" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ebe5db" }} />
            <span style={{ fontSize: "0.75rem", color: "#d9d0c3" }}>or</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ebe5db" }} />
          </div>

          <a
            href="/portal/login"
            style={{
              display: "block", width: "100%", padding: "0.75rem", fontSize: "0.9rem", fontWeight: 700,
              fontFamily: "'Source Sans 3', sans-serif", color: "#2d5446", backgroundColor: "transparent",
              border: "1.5px solid #ebe5db", borderRadius: "10px", cursor: "pointer", textAlign: "center",
              textDecoration: "none", transition: "border-color 0.15s, background-color 0.15s", boxSizing: "border-box",
            }}
            onMouseOver={(e) => { (e.target as HTMLElement).style.borderColor = "#2d5446"; (e.target as HTMLElement).style.backgroundColor = "#f3faf6"; }}
            onMouseOut={(e) => { (e.target as HTMLElement).style.borderColor = "#ebe5db"; (e.target as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            Already have an account? Sign in
          </a>

          <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#d9d0c3", marginTop: "2rem" }}>
            <a
              href="https://lostsierrakids.com"
              style={{ color: "inherit", textDecoration: "none", transition: "color 0.15s" }}
              onMouseOver={(e) => { (e.target as HTMLElement).style.color = "#4a7c67"; }}
              onMouseOut={(e) => { (e.target as HTMLElement).style.color = "#d9d0c3"; }}
            >
              &larr; Back to lostsierrakids.com
            </a>
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
