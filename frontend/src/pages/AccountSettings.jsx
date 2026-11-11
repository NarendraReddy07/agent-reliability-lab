import { useState } from "react";
import {
  Settings,
  UserRound,
  Monitor,
  Save,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "arl-account-preferences";

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    return {
      displayName: saved.displayName || "",
      email: saved.email || "",
      defaultPage: saved.defaultPage || "/",
    };
  } catch {
    return {
      displayName: "",
      email: "",
      defaultPage: "/",
    };
  }
}

export default function AccountSettings({ theme, setTheme }) {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [saved, setSaved] = useState(false);

  function update(field, value) {
    setPreferences((current) => ({
      ...current,
      [field]: value,
    }));
    setSaved(false);
  }

  function saveSettings(event) {
    event.preventDefault();

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      setSaved(true);
      toast.success("Account settings saved");
    } catch {
      toast.error("Unable to save account settings");
    }
  }

  function resetSettings() {
    const defaults = {
      displayName: "",
      email: "",
      defaultPage: "/",
    };

    try {
      setPreferences(defaults);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      setSaved(false);
      toast.success("Account preferences reset");
    } catch {
      toast.error("Unable to reset account preferences");
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid var(--border-color)",
    borderRadius: 9,
    background: "var(--surface)",
    color: "var(--text-primary)",
    outline: "none",
    fontSize: 13,
  };

  const labelStyle = {
    display: "block",
    marginBottom: 8,
    color: "var(--text-primary)",
    fontSize: 13,
    fontWeight: 600,
  };

  return (
    <div className="profile-page">
      <div className="profile-page-heading">
        <div>
          <span className="section-eyebrow">PREFERENCES</span>
          <h1>Account Settings</h1>
          <p>Manage your profile information and workspace preferences.</p>
        </div>
      </div>

      <form onSubmit={saveSettings}>
        <div className="profile-section-grid">
          <section className="profile-detail-card">
            <div className="profile-card-heading">
              <UserRound size={19} />
              <h2>Profile information</h2>
            </div>

            <div style={{ marginTop: 24 }}>
              <label style={labelStyle} htmlFor="display-name">
                Display name
              </label>
              <input
                id="display-name"
                style={inputStyle}
                value={preferences.displayName}
                onChange={(event) => update("displayName", event.target.value)}
                placeholder="Enter your display name"
                maxLength={80}
              />
            </div>

            <div style={{ marginTop: 20 }}>
              <label style={labelStyle} htmlFor="email-address">
                Email address
              </label>
              <input
                id="email-address"
                type="email"
                style={inputStyle}
                value={preferences.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="Enter your email address"
                maxLength={254}
              />
            </div>

            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 11,
                lineHeight: 1.6,
                marginTop: 14,
              }}
            >
              These details are saved in this browser. They do not change
              your administrator login credentials or backend account.
            </p>
          </section>

          <section className="profile-detail-card">
            <div className="profile-card-heading">
              <Monitor size={19} />
              <h2>Appearance</h2>
            </div>

            <div style={{ marginTop: 24 }}>
              <label style={labelStyle}>Workspace theme</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {["dark", "light"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTheme(option)}
                    aria-pressed={theme === option}
                    style={{
                      padding: "11px 18px",
                      borderRadius: 9,
                      border: `1px solid ${
                        theme === option ? "var(--accent)" : "var(--border-color)"
                      }`,
                      background:
                        theme === option ? "var(--surface-hover)" : "var(--surface)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      textTransform: "capitalize",
                      fontSize: 13,
                    }}
                  >
                    {option === "dark" ? "Dark mode" : "Light mode"}
                    {theme === option ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 26 }}>
              <label style={labelStyle} htmlFor="default-page">
                Default landing page
              </label>
              <select
                id="default-page"
                style={inputStyle}
                value={preferences.defaultPage}
                onChange={(event) => update("defaultPage", event.target.value)}
              >
                <option value="/">Overview</option>
                <option value="/agents">Agents</option>
                <option value="/datasets">Datasets</option>
                <option value="/evaluations">Evaluations</option>
                <option value="/analytics">Analytics</option>
                <option value="/executions">Executions</option>
                <option value="/traces">Traces</option>
                <option value="/schedules">Schedules</option>
              </select>
            </div>
          </section>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 22,
          }}
        >
          <button
            type="button"
            className="secondary-button"
            onClick={resetSettings}
          >
            <RotateCcw size={16} />
            Reset preferences
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {saved && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--success, #10b981)",
                  fontSize: 12,
                }}
              >
                <CheckCircle2 size={15} />
                Saved
              </span>
            )}

            <button type="submit" className="primary-button">
              <Save size={16} />
              Save settings
            </button>
          </div>
        </div>
      </form>

      <section className="profile-detail-card" style={{ marginTop: 24 }}>
        <div className="profile-card-heading">
          <Settings size={19} />
          <h2>Security and authentication</h2>
        </div>

        <div className="profile-detail-row">
          <span>Authentication method</span>
          <strong>JWT Bearer token</strong>
        </div>
        <div className="profile-detail-row">
          <span>Account management</span>
          <strong>Administrator environment configuration</strong>
        </div>
        <div className="profile-detail-row">
          <span>Password changes</span>
          <strong>Not available in this interface</strong>
        </div>
      </section>
    </div>
  );
}