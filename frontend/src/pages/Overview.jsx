import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  FlaskConical,
  XCircle,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api, { getApiError } from "../lib/api";

function MetricCard({ label, value, description, icon: Icon, loading }) {
  return (
    <article className="metric-card">
      <div className="metric-card-top">
        <span>{label}</span>
        <div className="metric-icon"><Icon size={19} /></div>
      </div>
      {loading ? <div className="skeleton metric-skeleton" /> : <div className="metric-value">{value}</div>}
      <div className="metric-description">{description}</div>
    </article>
  );
}

function LoadingCard() {
  return (
    <div className="metric-card">
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-value" />
      <div className="skeleton skeleton-line short" />
    </div>
  );
}

function ErrorPanel({ message, onRetry }) {
  return (
    <div className="error-panel">
      <XCircle size={21} />
      <div><strong>Unable to load dashboard data</strong><p>{message}</p></div>
      <button className="secondary-button" onClick={onRetry}>
        <RefreshCw size={15} /> Retry
      </button>
    </div>
  );
}

export default function Overview() {
  const agentMetrics = useQuery({
    queryKey: ["agent-metrics"],
    queryFn: async () => (await api.get("/agents/metrics")).data,
  });

  const evaluationMetrics = useQuery({
    queryKey: ["evaluation-overview"],
    queryFn: async () => (await api.get("/evaluations/metrics/overview")).data,
  });

  const recentExecutions = useQuery({
    queryKey: ["recent-executions"],
    queryFn: async () => (await api.get("/agents/metrics/recent?limit=5")).data,
  });

  const recentEvaluations = useQuery({
    queryKey: ["recent-evaluations"],
    queryFn: async () => (await api.get("/evaluations/metrics/recent?limit=7")).data,
  });

  const metricsLoading = agentMetrics.isLoading || evaluationMetrics.isLoading;
  const metricsError = agentMetrics.error || evaluationMetrics.error;

  const retryMetrics = () => {
    agentMetrics.refetch();
    evaluationMetrics.refetch();
    recentExecutions.refetch();
    recentEvaluations.refetch();
  };

  const chartData = [...(recentEvaluations.data || [])].reverse().map((item, index) => ({
    name: `Run ${index + 1}`,
    accuracy: item.accuracy,
  }));

  const formatDate = (value) => {
    if (!value) return "Unknown";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
  };

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="status-dot" />SYSTEM OVERVIEW</div>
          <h1>Dashboard</h1>
          <p>Monitor your AI agents, evaluation quality and execution performance.</p>
        </div>
        <button className="secondary-button" onClick={retryMetrics}>
          <RefreshCw size={16} /> Refresh data
        </button>
      </section>

      {metricsError && (
        <ErrorPanel message={getApiError(metricsError)} onRetry={retryMetrics} />
      )}

      <section className="metrics-grid">
        {metricsLoading ? Array.from({ length: 4 }).map((_, index) => <LoadingCard key={index} />) : (
          <>
            <MetricCard label="Total executions" value={agentMetrics.data?.total_executions ?? 0} description="Recorded agent executions" icon={Activity} />
            <MetricCard label="Success rate" value={`${agentMetrics.data?.success_rate ?? 0}%`} description={`${agentMetrics.data?.completed_executions ?? 0} completed executions`} icon={CheckCircle2} />
            <MetricCard label="Average latency" value={`${agentMetrics.data?.average_duration_ms ?? 0} ms`} description="Average execution duration" icon={Clock3} />
            <MetricCard label="Evaluation runs" value={evaluationMetrics.data?.total_evaluation_runs ?? 0} description={`${evaluationMetrics.data?.average_accuracy ?? 0}% average accuracy`} icon={FlaskConical} />
          </>
        )}
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div><h2>Evaluation performance</h2><p>Accuracy across recent evaluation runs</p></div>
            <div className="panel-icon"><ArrowUpRight size={18} /></div>
          </div>
          {recentEvaluations.isLoading ? <div className="skeleton chart-skeleton" /> : recentEvaluations.error ? (
            <div className="inline-error">{getApiError(recentEvaluations.error)}</div>
          ) : chartData.length === 0 ? (
            <div className="empty-state"><FlaskConical size={28} /><strong>No evaluation history yet</strong><span>Run an evaluation to see performance trends.</span></div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                  <defs><linearGradient id="accuracyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.28} /><stop offset="95%" stopColor="#10b981" stopOpacity={0.01} /></linearGradient></defs>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-primary)" }} formatter={(value) => [`${value}%`, "Accuracy"]} />
                  <Area type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2.5} fill="url(#accuracyFill)" activeDot={{ r: 5, fill: "#10b981" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="panel health-panel">
          <div className="panel-heading"><div><h2>Execution health</h2><p>Current recorded execution status</p></div><Activity size={19} className="muted-icon" /></div>
          {agentMetrics.isLoading ? <div className="skeleton health-skeleton" /> : agentMetrics.error ? (
            <div className="inline-error">{getApiError(agentMetrics.error)}</div>
          ) : (
            <>
              <div className="health-total">{agentMetrics.data?.total_executions ?? 0}<span> total executions</span></div>
              <div className="health-row"><span><CheckCircle2 size={16} /> Completed</span><strong>{agentMetrics.data?.completed_executions ?? 0}</strong></div>
              <div className="health-row"><span><XCircle size={16} /> Failed</span><strong>{agentMetrics.data?.failed_executions ?? 0}</strong></div>
              <div className="health-row"><span><Clock3 size={16} /> Maximum latency</span><strong>{agentMetrics.data?.maximum_duration_ms ?? 0} ms</strong></div>
            </>
          )}
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel table-panel">
          <div className="panel-heading"><div><h2>Recent executions</h2><p>Latest agent activity</p></div><Bot size={19} className="muted-icon" /></div>
          {recentExecutions.isLoading ? <div className="skeleton table-skeleton" /> : recentExecutions.error ? (
            <div className="inline-error">{getApiError(recentExecutions.error)}</div>
          ) : !recentExecutions.data?.length ? (
            <div className="empty-state compact"><Bot size={25} /><strong>No executions recorded</strong><span>Agent activity will appear here.</span></div>
          ) : (
            <div className="table-scroll responsive-table">
              <table>
                <thead><tr><th>Agent</th><th>Status</th><th>Duration</th><th>Executed</th></tr></thead>
                <tbody>
                  {recentExecutions.data.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Agent" className="primary-cell">{item.agent_name}</td>
                      <td data-label="Status"><span className={`status-pill ${item.status}`}>{item.status}</span></td>
                      <td data-label="Duration" className="numeric">{item.duration_ms} ms</td>
                      <td data-label="Executed" className="muted-cell">{formatDate(item.executed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel table-panel">
          <div className="panel-heading"><div><h2>Recent evaluations</h2><p>Latest evaluation results</p></div><FlaskConical size={19} className="muted-icon" /></div>
          {recentEvaluations.isLoading ? <div className="skeleton table-skeleton" /> : recentEvaluations.error ? (
            <div className="inline-error">{getApiError(recentEvaluations.error)}</div>
          ) : !recentEvaluations.data?.length ? (
            <div className="empty-state compact"><FlaskConical size={25} /><strong>No evaluations recorded</strong><span>Evaluation history will appear here.</span></div>
          ) : (
            <div className="table-scroll responsive-table">
              <table>
                <thead><tr><th>Run</th><th>Accuracy</th><th>Cases</th><th>Status</th></tr></thead>
                <tbody>
                  {recentEvaluations.data.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Run" className="primary-cell">#{item.id}</td>
                      <td data-label="Accuracy" className="numeric">{item.accuracy}%</td>
                      <td data-label="Cases" className="numeric">{item.total_cases}</td>
                      <td data-label="Status"><span className={`status-pill ${item.status}`}>{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
