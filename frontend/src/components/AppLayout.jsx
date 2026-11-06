import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  Bot,
  Database,
  FlaskConical,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Sun,
  Workflow,
  X,
  ChevronLeft,
  ChevronRight,
  Command,
  ChartNoAxesCombined,
} from "lucide-react";

const navigation = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Agents", path: "/agents", icon: Bot },
  { label: "Datasets", path: "/datasets", icon: Database },
  { label: "Evaluations", path: "/evaluations", icon: FlaskConical },
  { label: "Analytics", path: "/analytics", icon: ChartNoAxesCombined },
  { label: "Executions", path: "/executions", icon: Activity },
  { label: "Traces", path: "/traces", icon: Workflow },
];

export default function AppLayout({ theme, setTheme }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const toggleTheme = () => {
    setTheme((current) => current === "dark" ? "light" : "dark");
  };

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobileOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Activity size={21} strokeWidth={2.5} />
          </div>

          {!collapsed && (
            <div className="brand-copy">
              <span>Agent Reliability</span>
              <small>LAB</small>
            </div>
          )}

          <button
            className="icon-button mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        <div className="workspace-label">
          {!collapsed && "WORKSPACE"}
        </div>

        <nav className="navigation">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={19} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="status-dot" />
            {!collapsed && (
              <span>Monitoring workspace</span>
            )}
          </div>

          <button
            className="collapse-button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-divider">/</span>
              <strong>Agent Reliability Lab</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="command-trigger"
              disabled
              title="Command menu is being built"
            >
              <Command size={15} />
              <span>Search</span>
              <kbd>Ctrl K</kbd>
            </button>

            <button
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <div className="avatar" title="Agent Reliability Lab">
              AR
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>Agent Reliability Lab</span>
          <span>Built for reliable AI systems.</span>
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}