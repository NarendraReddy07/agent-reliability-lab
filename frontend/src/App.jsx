import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { Home, ArrowLeft, LoaderCircle } from "lucide-react";

import AppLayout from "./components/AppLayout";

const Overview = lazy(() => import("./pages/Overview"));
const Agents = lazy(() => import("./pages/Agents"));
const Datasets = lazy(() => import("./pages/Datasets"));
const Evaluations = lazy(() => import("./pages/Evaluations"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Executions = lazy(() => import("./pages/Executions"));
const TraceExplorer = lazy(() => import("./pages/TraceExplorer"));
const Schedules = lazy(() => import("./pages/Schedules"))

function PageLoading() {
  return (
    <div
      className="page-loading"
      role="status"
      aria-live="polite"
      style={{ minHeight: "45vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)", fontSize: 12 }}
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
      <Link to="/" className="primary-button"><Home size={17} />Return to dashboard</Link>
      <button className="text-button" onClick={() => window.history.back()}>
        <ArrowLeft size={15} />Go back
      </button>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("arl-theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("arl-theme", theme);
  }, [theme]);

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<AppLayout theme={theme} setTheme={setTheme} />}>
          <Route index element={<Overview />} />
          <Route path="agents" element={<Agents />} />
          <Route path="datasets" element={<Datasets />} />
          <Route path="evaluations" element={<Evaluations />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="executions" element={<Executions />} />
          <Route path="traces" element={<TraceExplorer />} />
          <Route path="*" element={<NotFound />} />
          <Route path="/schedules" element={<Schedules />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
