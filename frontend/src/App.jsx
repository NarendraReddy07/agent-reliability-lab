import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Home,
  ArrowLeft,
  LoaderCircle,
} from "lucide-react";

import AppLayout from "./components/AppLayout";
import Login from "./components/Login";
import {
  AUTH_STORAGE_KEY,
  REFRESH_STORAGE_KEY,
  USERNAME_STORAGE_KEY,
} from "./lib/api";

const Overview = lazy(() => import("./pages/Overview"));
const Agents = lazy(() => import("./pages/Agents"));
const Datasets = lazy(() => import("./pages/Datasets"));
const Evaluations = lazy(() => import("./pages/Evaluations"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Executions = lazy(() => import("./pages/Executions"));
const TraceExplorer = lazy(() => import("./pages/TraceExplorer"));
const Schedules = lazy(() => import("./pages/Schedules"));
const Profile = lazy(() => import("./pages/Profile"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));

const VALID_LANDING_PAGES = [
  "/",
  "/agents",
  "/datasets",
  "/evaluations",
  "/analytics",
  "/executions",
  "/traces",
  "/schedules",
];

function clearAuthenticationSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(REFRESH_STORAGE_KEY);
  sessionStorage.removeItem(USERNAME_STORAGE_KEY);
}

function getDefaultLandingPage() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("arl-account-preferences") || "{}"
    );

    return VALID_LANDING_PAGES.includes(saved.defaultPage)
      ? saved.defaultPage
      : "/";
  } catch {
    return "/";
  }
}

function PageLoading() {
  return (
    <div
      className="page-loading"
      role="status"
      aria-live="polite"
      style={{
        minHeight: "45vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: "var(--text-muted)",
        fontSize: 12,
      }}
    >
      <LoaderCircle size={22} className="spin" />
      <span>Loading workspace...</span>
    </div>
  );
}

function NotFound() {
  return (
    <div className="not-found">
      <span className="not-found-code">404</span>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>

      <Link to="/" className="primary-button">
        <Home size={17} />
        Return to dashboard
      </Link>

      <button
        className="text-button"
        onClick={() => window.history.back()}
      >
        <ArrowLeft size={15} />
        Go back
      </button>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(
    () => localStorage.getItem("arl-theme") || "dark"
  );

  const [authenticated, setAuthenticated] = useState(
    () => Boolean(sessionStorage.getItem(AUTH_STORAGE_KEY))
  );

  const landingPageApplied = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("arl-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (
      authenticated &&
      location.pathname === "/" &&
      !landingPageApplied.current
    ) {
      landingPageApplied.current = true;

      const defaultPage = getDefaultLandingPage();

      if (defaultPage !== "/") {
        navigate(defaultPage, { replace: true });
      }
    }
  }, [authenticated, location.pathname, navigate]);

  useEffect(() => {
    function handleAuthExpired() {
      clearAuthenticationSession();
      setAuthenticated(false);
      landingPageApplied.current = false;
    }

    window.addEventListener("arl-auth-expired", handleAuthExpired);

    return () => {
      window.removeEventListener(
        "arl-auth-expired",
        handleAuthExpired
      );
    };
  }, []);

  function handleAuthenticated() {
    landingPageApplied.current = true;
    setAuthenticated(true);

    navigate(getDefaultLandingPage(), { replace: true });
  }

  function handleLogout() {
    clearAuthenticationSession();
    setAuthenticated(false);
    landingPageApplied.current = false;
    navigate("/", { replace: true });
  }

  if (!authenticated) {
    return <Login onAuthenticated={handleAuthenticated} />;
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route
          element={
            <AppLayout
              theme={theme}
              setTheme={setTheme}
              onLogout={handleLogout}
            />
          }
        >
          <Route index element={<Overview />} />
          <Route path="agents" element={<Agents />} />
          <Route path="datasets" element={<Datasets />} />
          <Route path="evaluations" element={<Evaluations />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="executions" element={<Executions />} />
          <Route path="traces" element={<TraceExplorer />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="profile" element={<Profile />} />
          <Route
            path="settings"
            element={
              <AccountSettings
                theme={theme}
                setTheme={setTheme}
              />
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}