import { useMemo } from "react";
import {
  UserRound,
  ShieldCheck,
  LockKeyhole,
  Monitor,
  Activity,
} from "lucide-react";
import { USERNAME_STORAGE_KEY } from "../lib/api";

export default function Profile() {
  const username = useMemo(
    () => sessionStorage.getItem(USERNAME_STORAGE_KEY) || "Administrator",
    []
  );

  const accountInitial = username.charAt(0).toUpperCase();

  return (
    <div className="profile-page">
      <div className="profile-page-heading">
        <div>
          <span className="section-eyebrow">ACCOUNT</span>
          <h1>My Profile</h1>
          <p>Manage your account information and review your security status.</p>
        </div>
      </div>

      <section className="profile-overview-card">
        <div className="profile-overview-avatar">{accountInitial}</div>
        <div className="profile-overview-info">
          <h2>{username}</h2>
          <span className="profile-role-badge">
            <ShieldCheck size={14} />
            Administrator
          </span>
          <p>Agent Reliability Lab workspace account</p>
        </div>
      </section>

      <div className="profile-section-grid">
        <section className="profile-detail-card">
          <div className="profile-card-heading">
            <UserRound size={19} />
            <h2>Account information</h2>
          </div>

          <div className="profile-detail-row">
            <span>Username</span>
            <strong>{username}</strong>
          </div>
          <div className="profile-detail-row">
            <span>Account role</span>
            <strong>Administrator</strong>
          </div>
          <div className="profile-detail-row">
            <span>Workspace</span>
            <strong>Agent Reliability Lab</strong>
          </div>
          <div className="profile-detail-row">
            <span>Email address</span>
            <strong className="profile-muted-value">Not configured</strong>
          </div>
          <div className="profile-detail-row">
            <span>Display name</span>
            <strong className="profile-muted-value">Not configured</strong>
          </div>
        </section>

        <section className="profile-detail-card">
          <div className="profile-card-heading">
            <LockKeyhole size={19} />
            <h2>Security</h2>
          </div>

          <div className="profile-security-status">
            <span className="profile-security-indicator" />
            <div>
              <strong>Authentication active</strong>
              <p>Your current session is authenticated.</p>
            </div>
          </div>

          <div className="profile-detail-row">
            <span>Authentication method</span>
            <strong>JWT Bearer token</strong>
          </div>
          <div className="profile-detail-row">
            <span>Session storage</span>
            <strong>Browser session</strong>
          </div>
          <div className="profile-detail-row">
            <span>Password visibility</span>
            <strong>Protected</strong>
          </div>
        </section>

        <section className="profile-detail-card profile-environment-card">
          <div className="profile-card-heading">
            <Monitor size={19} />
            <h2>Workspace</h2>
          </div>

          <div className="profile-detail-row">
            <span>Application</span>
            <strong>Agent Reliability Lab</strong>
          </div>
          <div className="profile-detail-row">
            <span>Access level</span>
            <strong>Full administrative access</strong>
          </div>
          <div className="profile-detail-row">
            <span>Account status</span>
            <strong className="profile-active-value">
              <Activity size={14} />
              Active
            </strong>
          </div>
        </section>
      </div>
    </div>
  );
}