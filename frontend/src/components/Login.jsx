import { useState } from "react";
import {
  Activity,
  LockKeyhole,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import api, {
  AUTH_STORAGE_KEY,
  USERNAME_STORAGE_KEY,
  getApiError,
} from "../lib/api";

export default function Login({ onAuthenticated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Enter both your username and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.post(
        "/auth/login",
        null,
        {
          auth: {
            username: username.trim(),
            password,
          },
        }
      );

      const { access_token, username: authenticatedUsername } =
        response.data;

      if (!access_token) {
        throw new Error("The server did not return an access token.");
      }

      sessionStorage.setItem(AUTH_STORAGE_KEY, access_token);
      sessionStorage.setItem(
        USERNAME_STORAGE_KEY,
        authenticatedUsername
      );

      setPassword("");
      onAuthenticated();

      toast.success("Authentication successful.");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <Activity size={25} />
          </div>
          <span>AGENT RELIABILITY LAB</span>
        </div>

        <div className="login-heading">
          <div className="login-shield">
            <ShieldCheck size={22} />
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to access your evaluation workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="admin-username">Username</label>
          <div className="login-input-wrap">
            <User size={17} />
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              placeholder="Enter your username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <label htmlFor="admin-password">Password</label>
          <div className="login-input-wrap">
            <LockKeyhole size={17} />
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Sign in"}
          </button>
        </form>

        <div className="login-footer">
          <LockKeyhole size={14} />
          <span>Restricted access · Admin authentication</span>
        </div>
      </section>
    </main>
  );
}