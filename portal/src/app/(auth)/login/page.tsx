"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDebug("");
    setLoading(true);

    try {
      // Step 1: Get CSRF token
      const csrfRes = await fetch("/portal/api/auth/csrf");
      if (!csrfRes.ok) {
        setError(`Failed to reach auth server (${csrfRes.status})`);
        setDebug(`CSRF fetch failed: ${csrfRes.status} ${csrfRes.statusText}`);
        setLoading(false);
        return;
      }
      const { csrfToken } = await csrfRes.json();

      // Step 2: Post credentials
      const res = await fetch("/portal/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          csrfToken,
          email,
          password,
          redirect: "false",
          json: "true",
          callbackUrl: "/portal/dashboard",
        }),
        redirect: "manual",
      });

      // Step 3: Handle response
      const url = res.url;
      const status = res.status;

      if (status === 200 || status === 302) {
        // Check if there's an error in the redirect URL
        if (url && url.includes("error=")) {
          const errorParam = new URL(url).searchParams.get("error");
          setError(`Invalid email or password`);
          setDebug(`Auth error: ${errorParam}, URL: ${url}`);
          setLoading(false);
          return;
        }

        // Try to read response
        let data;
        try {
          data = await res.json();
        } catch {
          // Not JSON, likely a redirect — that means success
          window.location.href = "/portal/dashboard";
          return;
        }

        if (data?.url) {
          // NextAuth returned a redirect URL — success
          window.location.href = "/portal/dashboard";
          return;
        }

        if (data?.error) {
          setError("Invalid email or password");
          setDebug(`Response: ${JSON.stringify(data)}`);
          setLoading(false);
          return;
        }

        // If we got here with 200, assume success
        window.location.href = "/portal/dashboard";
      } else {
        setError(`Sign in failed (${status})`);
        let body = "";
        try { body = await res.text(); } catch {}
        setDebug(`Status: ${status}, URL: ${url}, Body: ${body.substring(0, 300)}`);
        setLoading(false);
      }
    } catch (err) {
      setError(`Connection error: ${err instanceof Error ? err.message : "Unknown"}`);
      setDebug(`Exception: ${err}`);
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
              backgroundColor: "#fff",
              padding: "12px",
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
        }}
      >
        <div style={{ width: "100%", maxWidth: "380px" }}>
          {/* Form header */}
          <div style={{ marginBottom: "2rem" }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.65rem", fontWeight: 700, color: "#1e3a2f", marginBottom: "0.5rem" }}>
              Welcome back
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#4a7c67" }}>
              Sign in to your family account
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: "1.5rem", padding: "0.75rem 1rem",
              backgroundColor: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: "10px", fontSize: "0.875rem", color: "#b91c1c", lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* Debug info — will remove once login works */}
          {debug && (
            <div style={{
              marginBottom: "1rem", padding: "0.75rem 1rem",
              backgroundColor: "#fefce8", border: "1px solid #fde68a",
              borderRadius: "10px", fontSize: "0.75rem", color: "#92400e", lineHeight: 1.5,
              wordBreak: "break-all",
            }}>
              Debug: {debug}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="email" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#2d5446", marginBottom: "0.4rem" }}>
                Email address
              </label>
              <input
                id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" placeholder="you@example.com"
                style={inputBase} onFocus={handleFocus} onBlur={handleBlur}
              />
            </div>

            <div style={{ marginBottom: "1.75rem" }}>
              <label htmlFor="password" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#2d5446", marginBottom: "0.4rem" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password" type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="Enter your password"
                  style={{ ...inputBase, paddingRight: "3rem" }}
                  onFocus={handleFocus} onBlur={handleBlur}
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)}
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

            <button
              type="submit" disabled={loading}
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
              {loading ? "Signing in\u2026" : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.75rem 0" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ebe5db" }} />
            <span style={{ fontSize: "0.75rem", color: "#d9d0c3" }}>or</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#ebe5db" }} />
          </div>

          <a
            href="/portal/register"
            style={{
              display: "block", width: "100%", padding: "0.75rem", fontSize: "0.9rem", fontWeight: 700,
              fontFamily: "'Source Sans 3', sans-serif", color: "#2d5446", backgroundColor: "transparent",
              border: "1.5px solid #ebe5db", borderRadius: "10px", cursor: "pointer", textAlign: "center",
              textDecoration: "none", transition: "border-color 0.15s, background-color 0.15s", boxSizing: "border-box",
            }}
            onMouseOver={(e) => { (e.target as HTMLElement).style.borderColor = "#2d5446"; (e.target as HTMLElement).style.backgroundColor = "#f3faf6"; }}
            onMouseOut={(e) => { (e.target as HTMLElement).style.borderColor = "#ebe5db"; (e.target as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            Create an account
          </a>

          <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#d9d0c3", marginTop: "2rem" }}>
            <a href="https://lostsierrakids.com" style={{ color: "inherit", textDecoration: "none", transition: "color 0.15s" }}
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
