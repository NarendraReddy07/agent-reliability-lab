import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import api, { getApiError } from "../lib/api";
import "./Agents.css";

function formatDuration(value) {
  if (value === null || value === undefined) return "—";
  const duration = Number(value);
  if (!Number.isFinite(duration)) return "—";
  return duration < 1 ? `${duration.toFixed(3)} ms` : `${duration.toFixed(2)} ms`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function getAgentMetrics(metrics, name) {
  return metrics.find((item) => item.agent_name === name) || {
    total_executions: 0,
    completed_executions: 0,
    failed_executions: 0,
    success_rate: 0,
    average_duration_ms: 0,
  };
}

export default function Agents() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [lastResult, setLastResult] = useState(null);

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: async () => (await api.get("/agents/")).data,
  });

  const metricsQuery = useQuery({
    queryKey: ["agent-metrics-by-agent"],
    queryFn: async () => (await api.get("/agents/metrics/by-agent")).data,
  });

  const recentQuery = useQuery({
    queryKey: ["agent-recent-executions"],
    queryFn: async () => (await api.get("/agents/metrics/recent?limit=8")).data,
  });

  const agents = agentsQuery.data?.agents || [];
  const metrics = metricsQuery.data || [];
  const recentExecutions = recentQuery.data || [];

  const filteredAgents = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return agents;
    return agents.filter((agent) =>
      `${agent.name} ${agent.description}`.toLowerCase().includes(normalized)
    );
  }, [agents, search]);

  const totals = useMemo(() => {
    return metrics.reduce(
      (result, item) => ({
        executions: result.executions + (item.total_executions || 0),
        completed: result.completed + (item.completed_executions || 0),
        failed: result.failed + (item.failed_executions || 0),
      }),
      { executions: 0, completed: 0, failed: 0 }
    );
  }, [metrics]);

  const runMutation = useMutation({
    mutationFn: async ({ agentName, value }) => {
      const response = await api.post(
        `/agents/${encodeURIComponent(agentName)}/execute`,
        { prompt: value }
      );
      return response.data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      setPrompt("");
      toast.success("Agent execution completed.");
      queryClient.invalidateQueries({ queryKey: ["agent-metrics-by-agent"] });
      queryClient.invalidateQueries({ queryKey: ["agent-recent-executions"] });
      queryClient.invalidateQueries({ queryKey: ["agent-executions"] });
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (error) => {
      toast.error(getApiError(error));
    },
  });

  function openRunner(agent) {
    setSelectedAgent(agent);
    setPrompt("");
    setLastResult(null);
  }

  function closeRunner() {
    if (runMutation.isPending) return;
    setSelectedAgent(null);
    setLastResult(null);
    setPrompt("");
  }

  function handleRun(event) {
    event.preventDefault();
    if (!selectedAgent || !prompt.trim()) return;
    runMutation.mutate({
      agentName: selectedAgent.name,
      value: prompt.trim(),
    });
  }

  const isLoading = agentsQuery.isLoading || metricsQuery.isLoading;
  const hasError = agentsQuery.isError || metricsQuery.isError;
  const error = agentsQuery.error || metricsQuery.error;

  return (
    <div className="page-stack agents-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            AGENT WORKSPACE
          </div>
          <h1>Agents</h1>
          <p>
            Manage registered agents, inspect their execution health, and run
            prompts against the agents connected to this workspace.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() => {
            agentsQuery.refetch();
            metricsQuery.refetch();
            recentQuery.refetch();
          }}
          disabled={agentsQuery.isFetching || metricsQuery.isFetching || recentQuery.isFetching}
        >
          <RefreshCw
            size={16}
            className={
              agentsQuery.isFetching || metricsQuery.isFetching || recentQuery.isFetching
                ? "spin"
                : ""
            }
          />
          Refresh
        </button>
      </section>

      <section className="agents-summary-grid">
        <article className="panel agents-summary-card">
          <div className="agents-summary-icon"><Bot size={18} /></div>
          <span>Registered agents</span>
          <strong>{isLoading ? "—" : agents.length}</strong>
          <small>Available in the agent registry</small>
        </article>
        <article className="panel agents-summary-card">
          <div className="agents-summary-icon"><Activity size={18} /></div>
          <span>Total executions</span>
          <strong>{metricsQuery.isLoading ? "—" : totals.executions}</strong>
          <small>Recorded across registered agents</small>
        </article>
        <article className="panel agents-summary-card">
          <div className="agents-summary-icon success"><CheckCircle2 size={18} /></div>
          <span>Completed</span>
          <strong>{metricsQuery.isLoading ? "—" : totals.completed}</strong>
          <small>Successfully completed executions</small>
        </article>
        <article className="panel agents-summary-card">
          <div className="agents-summary-icon warning"><ShieldCheck size={18} /></div>
          <span>Failed</span>
          <strong>{metricsQuery.isLoading ? "—" : totals.failed}</strong>
          <small>Executions recorded as failed</small>
        </article>
      </section>

      {hasError && (
        <div className="error-panel">
          <Zap size={20} />
          <div>
            <strong>Unable to load agent workspace</strong>
            <p>{getApiError(error)}</p>
          </div>
        </div>
      )}

      <section className="panel agents-registry-panel">
        <div className="agents-section-heading">
          <div>
            <h2>Agent registry</h2>
            <p>Agents currently registered with the backend service.</p>
          </div>
          <label className="agents-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search agents..."
              aria-label="Search agents"
            />
          </label>
        </div>

        {isLoading ? (
          <div className="agents-card-grid">
            {[1, 2].map((item) => (
              <div className="agents-loading-card" key={item}>
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-value" />
                <div className="skeleton skeleton-line short" />
              </div>
            ))}
          </div>
        ) : !hasError && filteredAgents.length === 0 ? (
          <div className="empty-state">
            <Bot size={28} />
            <strong>{agents.length ? "No matching agents" : "No agents registered"}</strong>
            <span>
              {agents.length
                ? "Try a different search term."
                : "Register an agent in the backend to make it available here."}
            </span>
          </div>
        ) : !hasError ? (
          <div className="agents-card-grid">
            {filteredAgents.map((agent) => {
              const itemMetrics = getAgentMetrics(metrics, agent.name);
              return (
                <article className="agents-card" key={agent.name}>
                  <div className="agents-card-top">
                    <div className="agents-avatar"><Bot size={20} /></div>
                    <span className="agents-registered"><span /> Registered</span>
                  </div>
                  <h3>{agent.name}</h3>
                  <p className="agents-description">{agent.description || "No description provided."}</p>

                  <div className="agents-card-stats">
                    <div>
                      <span>Executions</span>
                      <strong>{itemMetrics.total_executions}</strong>
                    </div>
                    <div>
                      <span>Success rate</span>
                      <strong>{itemMetrics.total_executions ? `${itemMetrics.success_rate}%` : "—"}</strong>
                    </div>
                    <div>
                      <span>Avg. duration</span>
                      <strong>{itemMetrics.total_executions ? formatDuration(itemMetrics.average_duration_ms) : "—"}</strong>
                    </div>
                  </div>

                  <div className="agents-card-footer">
                    <span className="agents-provider-label">
                      <span className="status-dot" />
                      Backend registered
                    </span>
                    <button className="primary-button" onClick={() => openRunner(agent)}>
                      <Play size={14} />
                      Run agent
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="panel agents-activity-panel">
        <div className="agents-section-heading">
          <div>
            <h2>Recent agent activity</h2>
            <p>Latest executions recorded by the backend.</p>
          </div>
          <Clock3 size={18} className="muted-icon" />
        </div>

        {recentQuery.isLoading ? (
          <div className="agents-loading-list">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </div>
        ) : recentQuery.isError ? (
          <div className="analytics-inline-error">{getApiError(recentQuery.error)}</div>
        ) : recentExecutions.length === 0 ? (
          <div className="empty-state compact">
            <Activity size={25} />
            <strong>No execution activity yet</strong>
            <span>Run an agent to start building execution history.</span>
          </div>
        ) : (
          <div className="agents-activity-list">
            {recentExecutions.map((execution, index) => (
              <div className="agents-activity-row" key={`${execution.agent_name}-${execution.executed_at}-${index}`}>
                <div className="agents-activity-icon"><Terminal size={16} /></div>
                <div className="agents-activity-main">
                  <strong>{execution.agent_name}</strong>
                  <span>{formatDate(execution.executed_at)}</span>
                </div>
                <span className={`status-pill ${execution.status}`}>
                  {execution.status}
                </span>
                <strong className="agents-activity-duration">{formatDuration(execution.duration_ms)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedAgent && (
        <div className="agents-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeRunner();
        }}>
          <section
            className="agents-runner-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agents-runner-title"
          >
            <div className="agents-runner-heading">
              <div>
                <span className="eyebrow">EXECUTION CONSOLE</span>
                <h2 id="agents-runner-title">Run {selectedAgent.name}</h2>
                <p>Send a prompt to this registered agent.</p>
              </div>
              <button className="icon-button" onClick={closeRunner} disabled={runMutation.isPending} aria-label="Close execution console">
                <X size={18} />
              </button>
            </div>

            <form className="agents-runner-form" onSubmit={handleRun}>
              <label htmlFor="agent-prompt">Prompt</label>
              <textarea
                id="agent-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Enter a prompt for the agent..."
                rows={5}
                maxLength={5000}
                required
                autoFocus
              />
              <div className="agents-prompt-footer">
                <small>{prompt.length}/5000 characters</small>
                <button className="primary-button" type="submit" disabled={!prompt.trim() || runMutation.isPending}>
                  <Play size={14} />
                  {runMutation.isPending ? "Running..." : "Execute agent"}
                </button>
              </div>
            </form>

            {runMutation.isError && (
              <div className="error-panel">
                <Zap size={18} />
                <div><strong>Execution failed</strong><p>{getApiError(runMutation.error)}</p></div>
              </div>
            )}

            {lastResult && (
              <div className="agents-run-result">
                <div className="agents-run-result-heading">
                  <span><CheckCircle2 size={16} /> Execution completed</span>
                  <small>Execution #{lastResult.execution_id}</small>
                </div>
                <div className="agents-run-result-block">
                  <label>Agent output</label>
                  <p>{lastResult.output || "The agent returned an empty response."}</p>
                </div>
                <div className="agents-run-result-meta">
                  <span>Status <strong>{lastResult.status}</strong></span>
                  <span>Duration <strong>{formatDuration(lastResult.duration_ms)}</strong></span>
                  <span>Provider <strong>{lastResult.metadata?.provider || "—"}</strong></span>
                  <span>Model <strong>{lastResult.metadata?.model || "—"}</strong></span>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
