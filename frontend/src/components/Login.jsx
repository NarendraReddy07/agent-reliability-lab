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
  REFRESH_STORAGE_KEY,
  USERNAME_STORAGE_KEY,
  getApiError,
  waitForBackend,
} from "../lib/api";

export default function Login({ onAuthenticated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Enter both your username and password.");
      return;
    }

    setLoading(true);
    setError("");
    setConnectionStatus("Checking backend availability...");

    try {
      await waitForBackend(setConnectionStatus);

      const response = await api.post("/auth/login", {
        username: username.trim(),
        password,
      });

      const {
        access_token,
        refresh_token,
        username: authenticatedUsername,
      } = response.data;

      if (!access_token || !refresh_token || !authenticatedUsername) {
        throw new Error("The server returned an incomplete authentication response.");
      }

      sessionStorage.setItem(AUTH_STORAGE_KEY, access_token);
      sessionStorage.setItem(REFRESH_STORAGE_KEY, refresh_token);
      sessionStorage.setItem(USERNAME_STORAGE_KEY, authenticatedUsername);

      setPassword("");
      setConnectionStatus("");
      onAuthenticated();
      toast.success("Authentication successful.");
    } catch (requestError) {
      setError(getApiError(requestError));
      setConnectionStatus("");
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
              disabled={loading}
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
              disabled={loading}
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={loading}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {connectionStatus && (
            <div
              className="login-connection-status"
              role="status"
              aria-live="polite"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                marginTop: 7,
                padding: "10px 12px",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                borderRadius: 8,
                background: "rgba(99, 102, 241, 0.08)",
                color: "var(--text-muted, #94a3b8)",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <Activity size={15} className="spin" />
              <span>{connectionStatus}</span>
            </div>
          )}

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
            {loading ? "Waking up backend..." : "Sign in"}
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
