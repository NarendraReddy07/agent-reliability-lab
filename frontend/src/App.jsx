import { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

import AppLayout from "./components/AppLayout";
import Overview from "./pages/Overview";
import ResourcePage from "./pages/ResourcePage";
import TraceExplorer from "./pages/TraceExplorer";
import Datasets from "./pages/Datasets";
import Evaluations from "./pages/Evaluations";
import Analytics from "./pages/Analytics";
import Agents from "./pages/Agents";
import Executions from "./pages/Executions";

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
      </Route>
    </Routes>
  );
}
