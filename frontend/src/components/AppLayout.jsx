import { useEffect, useMemo, useRef, useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Activity,
  Bot,
  Database,
  FlaskConical,
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
  CalendarClock,
  UserRound,
  ChevronDown,
  Settings,
  ShieldCheck,
  LogOut,
  Search,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
} from "lucide-react";

import { USERNAME_STORAGE_KEY } from "../lib/api";

const navigation = [
  { label: "Overview", path: "/", icon: LayoutDashboard, keywords: "dashboard home metrics" },
  { label: "Agents", path: "/agents", icon: Bot, keywords: "ai models execution" },
  { label: "Datasets", path: "/datasets", icon: Database, keywords: "test cases data library" },
  { label: "Evaluations", path: "/evaluations", icon: FlaskConical, keywords: "benchmark scoring accuracy" },
  { label: "Analytics", path: "/analytics", icon: ChartNoAxesCombined, keywords: "charts reports performance" },
  { label: "Executions", path: "/executions", icon: Activity, keywords: "history runs results" },
  { label: "Traces", path: "/traces", icon: Workflow, keywords: "logs debugging workflow" },
  { label: "Schedules", path: "/schedules", icon: CalendarClock, keywords: "scheduled recurring benchmarks" },
  { label: "My Profile", path: "/profile", icon: UserRound, keywords: "account administrator identity" },
  { label: "Account Settings", path: "/settings", icon: Settings, keywords: "preferences appearance theme" },
];

function getUsername() {
  return sessionStorage.getItem(USERNAME_STORAGE_KEY) || "Administrator";
}

export default function AppLayout({ theme, setTheme, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const profileRef = useRef(null);
  const searchInputRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const username = getUsername();

  const toggleTheme = () => {
    setTheme((current) => current === "dark" ? "light" : "dark");
  };

  const filteredNavigation = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return navigation;

    return navigation.filter((item) =>
      `${item.label} ${item.keywords}`.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  function openSearch() {
    setProfileOpen(false);
    setSearchQuery("");
    setActiveIndex(0);
    setSearchOpen(true);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveIndex(0);
  }

  function navigateTo(path) {
    closeSearch();
    setProfileOpen(false);
    setMobileOpen(false);
    navigate(path);
  }

  function handleSearchKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.min(current + 1, filteredNavigation.length - 1)
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = filteredNavigation[activeIndex];
      if (selected) navigateTo(selected.path);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
    }
  }

  useEffect(() => {
    setProfileOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    function handleGlobalShortcut(event) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setSearchOpen((current) => !current);
        setSearchQuery("");
        setActiveIndex(0);
        setProfileOpen(false);
      }
    }

    document.addEventListener("keydown", handleGlobalShortcut);
    return () => document.removeEventListener("keydown", handleGlobalShortcut);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

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
          {navigation
            .filter((item) => !["My Profile", "Account Settings"].includes(item.label))
            .map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
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
            {!collapsed && <span>Monitoring workspace</span>}
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
              type="button"
              className="command-trigger"
              onClick={openSearch}
              title="Search workspace (Ctrl + K)"
              aria-label="Search workspace"
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

            <div className="profile-menu-wrapper" ref={profileRef}>
              <button
                type="button"
                className={`profile-trigger ${profileOpen ? "profile-trigger-active" : ""}`}
                onClick={() => setProfileOpen((value) => !value)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-label="Open user profile menu"
              >
                <span className="profile-avatar">
                  {username.charAt(0).toUpperCase()}
                </span>
                <ChevronDown size={15} className="profile-chevron" />
              </button>

              {profileOpen && (
                <div className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-header">
                    <span className="profile-avatar profile-avatar-large">
                      {username.charAt(0).toUpperCase()}
                    </span>
                    <div className="profile-dropdown-identity">
                      <strong>{username}</strong>
                      <span>Administrator</span>
                    </div>
                  </div>

                  <div className="profile-dropdown-divider" />

                  <button
                    type="button"
                    className="profile-dropdown-item"
                    role="menuitem"
                    onClick={() => navigateTo("/profile")}
                  >
                    <UserRound size={17} />
                    <span>My Profile</span>
                  </button>

                  <button
                    type="button"
                    className="profile-dropdown-item"
                    role="menuitem"
                    onClick={() => navigateTo("/settings")}
                  >
                    <Settings size={17} />
                    <span>Account settings</span>
                  </button>

                  <div className="profile-dropdown-divider" />

                  <div className="profile-security-note">
                    <ShieldCheck size={15} />
                    <span>Authenticated session</span>
                  </div>

                  <button
                    type="button"
                    className="profile-dropdown-item profile-logout"
                    role="menuitem"
                    onClick={onLogout}
                  >
                    <LogOut size={17} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
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

      {searchOpen && (
        <div
          className="command-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSearch();
          }}
        >
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Search workspace"
          >
            <div className="command-search-input">
              <Search size={20} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search pages and workspace..."
                aria-label="Search pages"
                autoComplete="off"
              />
              <kbd>ESC</kbd>
              <button
                className="icon-button"
                onClick={closeSearch}
                aria-label="Close search"
              >
                <X size={18} />
              </button>
            </div>

            <div className="command-results">
              <div className="command-section-label">NAVIGATION</div>

              {filteredNavigation.length > 0 ? (
                filteredNavigation.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.path}
                      type="button"
                      className={`command-result ${activeIndex === index ? "active" : ""}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => navigateTo(item.path)}
                    >
                      <span className="command-result-icon">
                        <Icon size={17} />
                      </span>
                      <span className="command-result-label">{item.label}</span>
                      {activeIndex === index && (
                        <span className="command-result-enter">
                          <CornerDownLeft size={14} />
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="command-no-results">
                  <Search size={22} />
                  <strong>No matching pages</strong>
                  <span>Try another search term.</span>
                </div>
              )}
            </div>

            <div className="command-footer">
              <span>
                <kbd><ArrowUp size={11} /></kbd>
                <kbd><ArrowDown size={11} /></kbd>
                Navigate
              </span>
              <span>
                <kbd><CornerDownLeft size={11} /></kbd>
                Open page
              </span>
              <span>
                <kbd>ESC</kbd>
                Close
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}