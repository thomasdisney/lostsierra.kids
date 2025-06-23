import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, signup } from "./auth";
import "./LoginPage.css";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const { error } = isSignup
        ? await signup(email, password)
        : await login(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    }
  }

  return (
    <div className="login-container">
      <button
        onClick={() => navigate("/")}
        className="mb-4 text-blue-400 hover:underline"
      >
        Back
      </button>
      <h1 className="text-3xl font-bold text-white mb-6">
        {isSignup ? "Sign Up" : "Login"}
      </h1>
      <form onSubmit={handleSubmit} className="login-form">
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
          {isSignup ? "Sign Up" : "Login"}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
      <button
        onClick={() => setIsSignup(!isSignup)}
        className="mt-4 text-blue-400 hover:underline"
      >
        {isSignup ? "Already have an account? Login" : "Need an account? Sign Up"}
      </button>
    </div>
  );
}

export default LoginPage;
