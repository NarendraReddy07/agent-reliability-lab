import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Timer,
  CalendarClock,
  Cpu,
} from "lucide-react";

import api, { getApiError } from "../lib/api";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function formatPreciseTime(value) {
  if (!value) return "Timestamp unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid timestamp";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function formatMilliseconds(value) {
  if (value === null || value === undefined) return "—";

  const number = Number(value);

  return Number.isFinite(number) ? `${number.toFixed(3)} ms` : "—";
}

function formatEvent(event = "unknown_event") {
  return event.replaceAll("_", " ");
}

function getEventDescription(event = "") {
  const descriptions = {
    execution_started: "The agent execution was initialized.",
    agent_response: "The agent returned its response.",
    execution_completed: "The execution finished successfully.",
    execution_failed: "The execution stopped because an error occurred.",
  };

  return descriptions[event] || "An execution lifecycle event was recorded.";
}

function getEventIcon(event = "") {
  if (event.includes("failed") || event.includes("error")) {
    return XCircle;
  }

  if (event.includes("completed") || event.includes("response")) {
    return CheckCircle2;
  }

  return Activity;
}

function getEventStatus(event = "") {
  if (event.includes("failed") || event.includes("error")) {
    return "failed";
  }

  if (event.includes("completed") || event.includes("response")) {
    return "success";
  }

  return "neutral";
}

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="trace-stat">
      <Icon size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export default function TraceExplorer() {
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");

  const executionsQuery = useQuery({
    queryKey: ["trace-executions"],
    queryFn: async () => (await api.get("/agents/executions")).data,
  });

  const executions = Array.isArray(executionsQuery.data)
    ? executionsQuery.data
    : [];

  const filteredExecutions = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return executions;

    return executions.filter((execution) => {
      return (
        String(execution.id).includes(term) ||
        execution.agent_name?.toLowerCase().includes(term) ||
        execution.prompt?.toLowerCase().includes(term) ||
        execution.status?.toLowerCase().includes(term)
      );
    });
  }, [executions, search]);

  useEffect(() => {
    if (selectedId === null && executions.length > 0) {
      setSelectedId(executions[0].id);
    }
  }, [executions, selectedId]);

  const traceQuery = useQuery({
    queryKey: ["execution-trace", selectedId],
    queryFn: async () =>
      (await api.get(`/agents/executions/${selectedId}`)).data,
    enabled: selectedId !== null,
  });

  const execution = traceQuery.data;

  const events = useMemo(() => {
    if (!Array.isArray(execution?.trace)) return [];

    return [...execution.trace].sort((a, b) => {
      const elapsedA = Number(a.elapsed_ms);
      const elapsedB = Number(b.elapsed_ms);

      if (
        Number.isFinite(elapsedA) &&
        Number.isFinite(elapsedB)
      ) {
        return elapsedA - elapsedB;
      }

      return (
        new Date(a.timestamp).getTime() -
        new Date(b.timestamp).getTime()
      );
    });
  }, [execution?.trace]);

  const refreshAll = () => {
    executionsQuery.refetch();

    if (selectedId !== null) {
      traceQuery.refetch();
    }
  };

  const isRefreshing =
    executionsQuery.isFetching || traceQuery.isFetching;

  return (
    <div className="page-stack trace-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            OBSERVABILITY
          </div>

          <h1>Trace Explorer</h1>

          <p>
            Inspect agent execution events, timing, inputs,
            outputs, and lifecycle details.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={refreshAll}
          disabled={isRefreshing}
        >
          <RefreshCw
            size={16}
            className={isRefreshing ? "spin" : ""}
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
          <div>
            <strong>Unable to load executions</strong>
            <p>{getApiError(executionsQuery.error)}</p>
          </div>
        </section>
      ) : executions.length === 0 ? (
        <section className="panel empty-state">
          <Workflow size={30} />
          <strong>No executions recorded</strong>
          <span>
            Execute an agent to generate trace records.
          </span>
        </section>
      ) : (
        <div className="trace-layout">
          <section className="panel trace-list-panel">
            <div className="panel-heading">
              <div>
                <h2>Executions</h2>
                <p>
                  {filteredExecutions.length} of{" "}
                  {executions.length} records
                </p>
              </div>

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
                  className={`trace-execution-item ${
                    selectedId === item.id ? "active" : ""
                  }`}
                  onClick={() => setSelectedId(item.id)}
                  aria-pressed={selectedId === item.id}
                >
                  <div className="trace-item-top">
                    <span className="trace-item-id">
                      Execution #{item.id}
                    </span>

                    <span
                      className={`status-badge ${
                        item.status === "completed"
                          ? "success"
                          : "failed"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <strong>{item.agent_name}</strong>

                  <span className="trace-item-prompt">
                    {item.prompt || "No prompt recorded"}
                  </span>

                  <div className="trace-item-footer">
                    <span className="trace-item-date">
                      {formatDate(item.executed_at)}
                    </span>

                    <span className="trace-item-duration">
                      {formatMilliseconds(item.duration_ms)}
                    </span>
                  </div>
                </button>
              ))}

              {filteredExecutions.length === 0 && (
                <div className="trace-no-results">
                  No matching executions.
                </div>
              )}
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
                <div>
                  <strong>Unable to load trace details</strong>
                  <p>{getApiError(traceQuery.error)}</p>
                </div>
              </div>
            ) : execution ? (
              <>
                <div className="trace-detail-heading">
                  <div>
                    <div className="eyebrow">EXECUTION DETAIL</div>
                    <h2>Execution #{execution.id}</h2>
                    <p>{execution.agent_name}</p>
                  </div>

                  <span
                    className={`status-badge ${
                      execution.status === "completed"
                        ? "success"
                        : "failed"
                    }`}
                  >
                    {execution.status}
                  </span>
                </div>

                <div className="trace-stats-grid">
                  <MetricCard
                    icon={Clock3}
                    label="Total duration"
                    value={formatMilliseconds(execution.duration_ms)}
                    detail="End-to-end execution"
                  />

                  <MetricCard
                    icon={Workflow}
                    label="Trace events"
                    value={events.length}
                    detail="Recorded lifecycle events"
                  />

                  <MetricCard
                    icon={Bot}
                    label="Provider"
                    value={execution.provider || "—"}
                    detail={execution.model || "Model unavailable"}
                  />
                </div>

                <div className="trace-metadata">
                  <div>
                    <Cpu size={15} />
                    <span>Model</span>
                    <strong>{execution.model || "—"}</strong>
                  </div>

                  <div>
                    <CalendarClock size={15} />
                    <span>Executed at</span>
                    <strong>{formatDate(execution.executed_at)}</strong>
                  </div>
                </div>

                <div className="trace-section">
                  <div className="trace-section-heading">
                    <h3>Execution input</h3>
                    <span>INPUT</span>
                  </div>

                  <div className="trace-content-box">
                    {execution.prompt || "No input recorded"}
                  </div>
                </div>

                <div className="trace-section">
                  <div className="trace-section-heading">
                    <h3>Agent output</h3>
                    <span>OUTPUT</span>
                  </div>

                  <div className="trace-content-box output">
                    {execution.output || "No output recorded"}
                  </div>
                </div>

                {execution.error && (
                  <div className="trace-section">
                    <div className="trace-section-heading">
                      <h3>Error details</h3>
                      <span>ERROR</span>
                    </div>

                    <div className="trace-content-box error">
                      {execution.error}
                    </div>
                  </div>
                )}

                <div className="trace-section">
                  <div className="trace-section-heading">
                    <div>
                      <h3>Execution timeline</h3>
                      <p>
                        Chronological lifecycle events with precise timing
                      </p>
                    </div>

                    <span>{events.length} EVENTS</span>
                  </div>

                  {events.length === 0 ? (
                    <div className="empty-state trace-empty">
                      <Activity size={24} />
                      <strong>No trace events available</strong>
                      <span>
                        This execution has no recorded lifecycle events.
                      </span>
                    </div>
                  ) : (
                    <div className="trace-timeline">
                      {events.map((event, index) => {
                        const EventIcon = getEventIcon(event.event);
                        const eventStatus = getEventStatus(event.event);

                        return (
                          <div
                            className={`trace-event trace-event-${eventStatus}`}
                            key={`${event.event}-${index}`}
                          >
                            <div className="trace-event-marker">
                              <EventIcon size={17} />
                            </div>

                            <div className="trace-event-content">
                              <strong>
                                {formatEvent(event.event)}
                              </strong>

                              <p>
                                {getEventDescription(event.event)}
                              </p>

                              <span className="trace-event-timestamp">
                                {formatPreciseTime(event.timestamp)}
                              </span>

                              <div className="trace-event-metrics">
                                <span>
                                  <Timer size={13} />
                                  Elapsed:{" "}
                                  {formatMilliseconds(event.elapsed_ms)}
                                </span>

                                {event.duration_ms !== undefined && (
                                  <span>
                                    <Clock3 size={13} />
                                    Duration:{" "}
                                    {formatMilliseconds(event.duration_ms)}
                                  </span>
                                )}
                              </div>

                              {event.error && (
                                <div className="trace-event-error">
                                  {event.error}
                                </div>
                              )}
                            </div>

                            <span className="trace-event-number">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <Activity size={28} />
                <strong>Select an execution</strong>
                <span>
                  Choose an execution to inspect its trace.
                </span>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}