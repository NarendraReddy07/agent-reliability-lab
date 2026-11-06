
import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
} from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

import AppLayout from "./components/AppLayout";
import Overview from "./pages/Overview";
import ResourcePage from "./pages/ResourcePage";

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
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("arl-theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("arl-theme", theme);
  }, [theme]);

  return (
    <Routes>
      <Route
        element={
          <AppLayout
            theme={theme}
            setTheme={setTheme}
          />
        }
      >
        <Route index element={<Overview />} />

        <Route
          path="agents"
          element={
            <ResourcePage
              title="Agents"
              description="Discover the agents registered in your workspace."
              endpoint="/agents/"
              queryKey="agents"
            />
          }
        />

        <Route
          path="datasets"
          element={
            <ResourcePage
              title="Datasets"
              description="Inspect the datasets available for evaluation."
              endpoint="/datasets/"
              queryKey="datasets"
            />
          }
        />

        <Route
          path="evaluations"
          element={
            <ResourcePage
              title="Evaluations"
              description="Review evaluation runs and their recorded results."
              endpoint="/evaluations/"
              queryKey="evaluations"
            />
          }
        />

        <Route
          path="executions"
          element={
            <ResourcePage
              title="Executions"
              description="Inspect recorded agent execution activity."
              endpoint="/agents/executions"
              queryKey="executions"
            />
          }
        />

        <Route
          path="traces"
          element={
            <ResourcePage
              title="Trace explorer"
              description="Browse executions that have detailed trace records."
              endpoint="/agents/executions"
              queryKey="trace-executions"
            />
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}