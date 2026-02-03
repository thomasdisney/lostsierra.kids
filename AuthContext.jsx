import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("wms_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify token on mount
    if (token) {
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  async function verifyToken() {
    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setToken(null);
        localStorage.removeItem("wms_token");
      }
    } catch (error) {
      console.error("Token verification failed:", error);
      setToken(null);
      localStorage.removeItem("wms_token");
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const data = await response.json();
    const newToken = data.token;
    setToken(newToken);
    setUser(data.user);
    localStorage.setItem("wms_token", newToken);
    return data.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("wms_token");
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
