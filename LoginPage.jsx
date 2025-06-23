import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "./auth";
import "./LoginPage.css";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    const { error } = await login(email, password);
    if (error) {
      setError(error.message);
    } else {
      navigate("/dashboard");
    }
  }

  return (
    <div className="login-container">
      <h1 className="text-3xl font-bold text-white mb-6">Login</h1>
      <form onSubmit={handleLogin} className="login-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="input-field"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="input-field"
        />
        <button type="submit" className="login-btn">
          Login
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}

export default LoginPage;
