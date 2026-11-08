import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  RefreshCw,
  Search,
  Terminal,
  XCircle,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import api, { getApiError } from "../lib/api";
import "./Executions.css";

function formatDuration(value) {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? number < 1 ? `${number.toFixed(3)} ms` : `${number.toFixed(2)} ms`
    : "—";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function StatusBadge({ status }) {
  const normalized = (status || "unknown").toLowerCase();
  return (
    <span className={`execution-status ${normalized}`}>
      {normalized === "completed" ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {normalized}
    </span>
  );
}

export default function Executions() {
  const [searchParams] = useSearchParams();
  const requestedId = Number(searchParams.get("execution"));
  const initialId = Number.isInteger(requestedId) && requestedId > 0 ? requestedId : null;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(initialId);

  useEffect(() => {
    if (initialId !== null) setSelectedId(initialId);
  }, [initialId]);

  const executionsQuery = useQuery({
    queryKey: ["executions"],
    queryFn: async () => (await api.get("/agents/executions")).data,
  });

  const metricsQuery = useQuery({
    queryKey: ["execution-metrics"],
    queryFn: async () => (await api.get("/agents/metrics")).data,
  });

  const executions = Array.isArray(executionsQuery.data)
    ? executionsQuery.data
    : [];
  const metrics = metricsQuery.data || {};

  const filteredExecutions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return executions.filter((item) => {
      const matchesSearch =
        !term ||
        String(item.id).includes(term) ||
        item.agent_name?.toLowerCase().includes(term) ||
        item.prompt?.toLowerCase().includes(term) ||
        item.output?.toLowerCase().includes(term) ||
        item.status?.toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [executions, search, statusFilter]);

  const detailQuery = useQuery({
    queryKey: ["execution-detail", selectedId],
    queryFn: async () => (await api.get(`/agents/executions/${selectedId}`)).data,
    enabled: selectedId !== null,
  });

  const selectedExecution = detailQuery.data;

  function refreshAll() {
    executionsQuery.refetch();
    metricsQuery.refetch();
    if (selectedId !== null) detailQuery.refetch();
  }

  const loading = executionsQuery.isLoading || metricsQuery.isLoading;
  const error = executionsQuery.error || metricsQuery.error;

  return (
    <div className="page-stack executions-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            OBSERVABILITY
          </div>
          <h1>Executions</h1>
          <p>
            Review agent execution history, inspect inputs and outputs, and
            follow each run into its recorded trace.
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={refreshAll}
          disabled={executionsQuery.isFetching || metricsQuery.isFetching}
        >
          <RefreshCw
            size={16}
            className={executionsQuery.isFetching || metricsQuery.isFetching ? "spin" : ""}
          />
          Refresh
        </button>
      </section>

      <section className="execution-kpi-grid">
        <article className="panel execution-kpi">
          <div className="execution-kpi-icon"><Activity size={18} /></div>
          <span>Total executions</span>
          <strong>{loading ? "—" : metrics.total_executions ?? executions.length}</strong>
          <small>All recorded agent runs</small>
        </article>
        <article className="panel execution-kpi">
          <div className="execution-kpi-icon success"><CheckCircle2 size={18} /></div>
          <span>Completed</span>
          <strong>{loading ? "—" : metrics.completed_executions ?? 0}</strong>
          <small>{loading ? "—" : `${metrics.success_rate ?? 0}% success rate`}</small>
        </article>
        <article className="panel execution-kpi">
          <div className="execution-kpi-icon danger"><XCircle size={18} /></div>
          <span>Failed</span>
          <strong>{loading ? "—" : metrics.failed_executions ?? 0}</strong>
          <small>Recorded failed runs</small>
        </article>
        <article className="panel execution-kpi">
          <div className="execution-kpi-icon"><Clock3 size={18} /></div>
          <span>Average duration</span>
          <strong>{loading ? "—" : formatDuration(metrics.average_duration_ms)}</strong>
          <small>
            {loading ? "—" : `Min ${formatDuration(metrics.minimum_duration_ms)} · Max ${formatDuration(metrics.maximum_duration_ms)}`}
          </small>
        </article>
      </section>

      {error && (
        <div className="error-panel">
          <AlertCircle size={20} />
          <div>
            <strong>Unable to load execution history</strong>
            <p>{getApiError(error)}</p>
          </div>
        </div>
      )}

      <div className="executions-workspace">
        <section className="panel execution-history-panel">
          <div className="execution-panel-heading">
            <div>
              <h2>Execution history</h2>
              <p>{filteredExecutions.length} of {executions.length} runs</p>
            </div>
            <Terminal size={19} className="muted-icon" />
          </div>

          <label className="execution-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID, agent, prompt..."
              aria-label="Search executions"
            />
          </label>

          <div className="execution-filter-row" aria-label="Filter executions by status">
            {[
              ["all", "All"],
              ["completed", "Completed"],
              ["failed", "Failed"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`execution-filter ${statusFilter === value ? "active" : ""}`}
                onClick={() => setStatusFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {executionsQuery.isLoading ? (
            <div className="execution-history-loading">
              {[1, 2, 3].map((item) => (
                <div className="skeleton skeleton-line" key={item} />
              ))}
            </div>
          ) : executionsQuery.isError ? null : filteredExecutions.length === 0 ? (
            <div className="empty-state compact">
              <Terminal size={25} />
              <strong>{executions.length ? "No matching executions" : "No executions recorded"}</strong>
              <span>
                {executions.length
                  ? "Change the search term or status filter."
                  : "Run an agent from the Agents page to create execution records."}
              </span>
            </div>
          ) : (
            <div className="execution-history-list">
              {filteredExecutions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`execution-history-item ${selectedId === item.id ? "active" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="execution-history-top">
                    <strong>Execution #{item.id}</strong>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="execution-history-agent">
                    <Bot size={14} />
                    <span>{item.agent_name}</span>
                  </div>
                  <p>{item.prompt || "No prompt recorded"}</p>
                  <div className="execution-history-bottom">
                    <span>{formatDate(item.executed_at)}</span>
                    <strong>{formatDuration(item.duration_ms)}</strong>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel execution-detail-panel">
          {!selectedId ? (
            <div className="execution-detail-placeholder">
              <Activity size={30} />
              <h2>Select an execution</h2>
              <p>Choose a run from the history to inspect its details.</p>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="execution-detail-loading">
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-value" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-value" />
            </div>
          ) : detailQuery.isError ? (
            <div className="error-panel">
              <AlertCircle size={20} />
              <div>
                <strong>Unable to load execution details</strong>
                <p>{getApiError(detailQuery.error)}</p>
              </div>
            </div>
          ) : selectedExecution ? (
            <>
              <div className="execution-detail-heading">
                <div>
                  <div className="eyebrow">RUN INSPECTOR</div>
                  <h2>Execution #{selectedExecution.id}</h2>
                  <p>{selectedExecution.agent_name}</p>
                </div>
                <StatusBadge status={selectedExecution.status} />
              </div>

              <div className="execution-detail-meta">
                <div>
                  <span>Duration</span>
                  <strong>{formatDuration(selectedExecution.duration_ms)}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{selectedExecution.provider || "—"}</strong>
                </div>
                <div>
                  <span>Model</span>
                  <strong>{selectedExecution.model || "—"}</strong>
                </div>
                <div>
                  <span>Executed at</span>
                  <strong>{formatDate(selectedExecution.executed_at)}</strong>
                </div>
              </div>

              <div className="execution-content-section">
                <div className="execution-content-heading">
                  <h3>Input prompt</h3>
                  <span>INPUT</span>
                </div>
                <div className="execution-content-box">
                  {selectedExecution.prompt || "No input recorded."}
                </div>
              </div>

              <div className="execution-content-section">
                <div className="execution-content-heading">
                  <h3>Agent output</h3>
                  <span>OUTPUT</span>
                </div>
                <div className="execution-content-box output">
                  {selectedExecution.output || "No output recorded."}
                </div>
              </div>

              {selectedExecution.error && (
                <div className="execution-content-section">
                  <div className="execution-content-heading">
                    <h3>Error details</h3>
                    <span>ERROR</span>
                  </div>
                  <div className="execution-content-box error">
                    {selectedExecution.error}
                  </div>
                </div>
              )}

              <div className="execution-detail-footer">
                <div>
                  <strong>Trace available</strong>
                  <span>
                    {Array.isArray(selectedExecution.trace)
                      ? `${selectedExecution.trace.length} lifecycle events recorded`
                      : "Open the trace explorer to inspect lifecycle events."}
                  </span>
                </div>
                <Link
                  className="primary-button"
                  to={`/traces?execution=${selectedExecution.id}`}
                >
                  <ExternalLink size={14} />
                  Open trace
                </Link>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
