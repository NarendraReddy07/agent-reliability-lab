import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Workflow,
  XCircle,
} from "lucide-react";

import api, { getApiError } from "../lib/api";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "medium" });
}

function formatEvent(event) {
  return (event || "unknown").replaceAll("_", " ");
}

function getEventIcon(event) {
  if (event?.includes("completed") || event?.includes("response")) return CheckCircle2;
  if (event?.includes("failed") || event?.includes("error")) return XCircle;
  return Activity;
}

export default function TraceExplorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = Number(searchParams.get("execution"));
  const initialId = Number.isInteger(requestedId) && requestedId > 0 ? requestedId : null;
  const [selectedId, setSelectedId] = useState(initialId);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const value = Number(searchParams.get("execution"));
    if (Number.isInteger(value) && value > 0) setSelectedId(value);
  }, [searchParams]);

  const executionsQuery = useQuery({
    queryKey: ["trace-executions"],
    queryFn: async () => (await api.get("/agents/executions")).data,
  });

  const executions = Array.isArray(executionsQuery.data) ? executionsQuery.data : [];
  const filteredExecutions = executions.filter((execution) => {
    const term = search.toLowerCase();
    return (
      String(execution.id).includes(term) ||
      execution.agent_name?.toLowerCase().includes(term) ||
      execution.prompt?.toLowerCase().includes(term) ||
      execution.status?.toLowerCase().includes(term)
    );
  });

  useEffect(() => {
    if (selectedId === null && executions.length > 0) setSelectedId(executions[0].id);
  }, [executions, selectedId]);

  const traceQuery = useQuery({
    queryKey: ["execution-trace", selectedId],
    queryFn: async () => (await api.get(`/agents/executions/${selectedId}`)).data,
    enabled: selectedId !== null,
  });

  const execution = traceQuery.data;
  const events = Array.isArray(execution?.trace) ? execution.trace : [];

  function selectExecution(id) {
    setSelectedId(id);
    setSearchParams({ execution: String(id) });
  }

  return (
    <div className="page-stack trace-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            OBSERVABILITY
          </div>
          <h1>Trace Explorer</h1>
          <p>Inspect agent execution events, inputs, outputs, and lifecycle details.</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => {
            executionsQuery.refetch();
            if (selectedId !== null) traceQuery.refetch();
          }}
          disabled={executionsQuery.isFetching || traceQuery.isFetching}
        >
          <RefreshCw
            size={16}
            className={executionsQuery.isFetching || traceQuery.isFetching ? "spin" : ""}
          />
          Refresh
        </button>
      </section>

      {executionsQuery.isLoading ? (
        <section className="panel trace-loading">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-value" />
          <div className="skeleton skeleton-line" />
        </section>
      ) : executionsQuery.error ? (
        <section className="panel error-panel">
          <AlertCircle size={22} />
          <div><strong>Unable to load executions</strong><p>{getApiError(executionsQuery.error)}</p></div>
        </section>
      ) : executions.length === 0 ? (
        <section className="panel empty-state">
          <Workflow size={30} />
          <strong>No executions recorded</strong>
          <span>Execute an agent to generate trace records.</span>
        </section>
      ) : (
        <div className="trace-layout">
          <section className="panel trace-list-panel">
            <div className="panel-heading">
              <div><h2>Executions</h2><p>{filteredExecutions.length} of {executions.length} records</p></div>
              <Activity size={19} className="muted-icon" />
            </div>
            <div className="trace-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search executions..."
                aria-label="Search executions"
              />
            </div>
            <div className="trace-execution-list">
              {filteredExecutions.map((item) => (
                <button
                  key={item.id}
                  className={`trace-execution-item ${selectedId === item.id ? "active" : ""}`}
                  onClick={() => selectExecution(item.id)}
                >
                  <div className="trace-item-top">
                    <span className="trace-item-id">Execution #{item.id}</span>
                    <span className={`status-badge ${item.status === "completed" ? "success" : "failed"}`}>
                      {item.status}
                    </span>
                  </div>
                  <strong>{item.agent_name}</strong>
                  <span className="trace-item-prompt">{item.prompt || "No prompt recorded"}</span>
                  <span className="trace-item-date">{formatDate(item.executed_at)}</span>
                </button>
              ))}
              {filteredExecutions.length === 0 && <div className="trace-no-results">No matching executions.</div>}
            </div>
          </section>

          <section className="panel trace-detail-panel">
            {traceQuery.isLoading ? (
              <div className="trace-loading">
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-value" />
                <div className="skeleton skeleton-line" />
              </div>
            ) : traceQuery.error ? (
              <div className="error-panel">
                <AlertCircle size={22} />
                <div><strong>Unable to load trace details</strong><p>{getApiError(traceQuery.error)}</p></div>
              </div>
            ) : execution ? (
              <>
                <div className="trace-detail-heading">
                  <div><div className="eyebrow">EXECUTION DETAIL</div><h2>Execution #{execution.id}</h2><p>{execution.agent_name}</p></div>
                  <span className={`status-badge ${execution.status === "completed" ? "success" : "failed"}`}>{execution.status}</span>
                </div>

                <div className="trace-stats-grid">
                  <div className="trace-stat"><Clock3 size={17} /><span>Duration</span><strong>{execution.duration_ms ?? "—"} ms</strong></div>
                  <div className="trace-stat"><Workflow size={17} /><span>Events</span><strong>{events.length}</strong></div>
                  <div className="trace-stat"><Bot size={17} /><span>Provider</span><strong>{execution.provider || "—"}</strong></div>
                </div>

                <div className="trace-metadata">
                  <div><span>Model</span><strong>{execution.model || "—"}</strong></div>
                  <div><span>Executed at</span><strong>{formatDate(execution.executed_at)}</strong></div>
                </div>

                <div className="trace-section">
                  <div className="trace-section-heading"><h3>Execution input</h3><span>INPUT</span></div>
                  <div className="trace-content-box">{execution.prompt || "No input recorded"}</div>
                </div>
                <div className="trace-section">
                  <div className="trace-section-heading"><h3>Agent output</h3><span>OUTPUT</span></div>
                  <div className="trace-content-box output">{execution.output || "No output recorded"}</div>
                </div>
                {execution.error && (
                  <div className="trace-section">
                    <div className="trace-section-heading"><h3>Error details</h3><span>ERROR</span></div>
                    <div className="trace-content-box error">{execution.error}</div>
                  </div>
                )}

                <div className="trace-section">
                  <div className="trace-section-heading">
                    <div><h3>Execution timeline</h3><p>Recorded lifecycle events in chronological order</p></div>
                    <span>{events.length} EVENTS</span>
                  </div>
                  {events.length === 0 ? (
                    <div className="empty-state trace-empty"><Activity size={24} /><strong>No trace events available</strong><span>This execution has no recorded lifecycle events.</span></div>
                  ) : (
                    <div className="trace-timeline">
                      {events.map((event, index) => {
                        const EventIcon = getEventIcon(event.event);
                        return (
                          <div className="trace-event" key={`${event.event}-${index}`}>
                            <div className="trace-event-marker"><EventIcon size={17} /></div>
                            <div className="trace-event-content"><strong>{formatEvent(event.event)}</strong><span>{formatDate(event.timestamp)}</span></div>
                            <span className="trace-event-number">{String(index + 1).padStart(2, "0")}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state"><Activity size={28} /><strong>Select an execution</strong><span>Choose an execution to inspect its trace.</span></div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
