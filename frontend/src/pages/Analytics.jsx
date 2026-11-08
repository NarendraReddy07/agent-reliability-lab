import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertCircle, Bot, CheckCircle2, Clock3, Database,
  FlaskConical, RefreshCw, TrendingUp, XCircle, ShieldCheck,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip,
  XAxis, YAxis, ZAxis,
} from "recharts";

import api, { getApiError } from "../lib/api";
import "./AnalyticsAdvanced.css";

const colors = {
  green: "#10b981",
  red: "#ef6464",
  blue: "#60a5fa",
  purple: "#a78bfa",
  muted: "#94a3b8",
};

const rows = (value) => Array.isArray(value) ? value : [];
const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));

function formatDate(value) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

function MetricCard({ label, value, description, icon: Icon, tone = "" }) {
  return (
    <article className="analytics-metric panel">
      <div className={`analytics-metric-icon ${tone}`}><Icon size={19} /></div>
      <div className="analytics-metric-content">
        <span>{label}</span><strong>{value}</strong><small>{description}</small>
      </div>
    </article>
  );
}

function PanelHeading({ title, description, icon: Icon }) {
  return (
    <div className="panel-heading">
      <div><h2>{title}</h2><p>{description}</p></div>
      {Icon && <Icon size={19} className="muted-icon" />}
    </div>
  );
}

function LoadingPanel() {
  return <div className="analytics-loading"><div className="skeleton skeleton-line" /><div className="skeleton skeleton-value" /><div className="skeleton skeleton-line short" /></div>;
}

function ErrorMessage({ error }) {
  return <div className="analytics-inline-error"><AlertCircle size={17} /><span>{getApiError(error)}</span></div>;
}

function EmptyMessage({ message }) {
  return <div className="analytics-empty"><Activity size={24} /><span>{message}</span></div>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      <strong>{label ?? payload[0]?.payload?.agent_name ?? "Benchmark"}</strong>
      {payload.map((item) => (
        <div key={item.dataKey}><span>{item.name || item.dataKey}</span><b>{item.value}{item.unit || ""}</b></div>
      ))}
    </div>
  );
}

function StatusPill({ status }) {
  return <span className={`status-pill ${String(status || "unknown").toLowerCase()}`}>{status || "unknown"}</span>;
}

export default function Analytics() {
  const executionQuery = useQuery({
    queryKey: ["agent-metrics"],
    queryFn: async () => (await api.get("/agents/metrics")).data,
  });
  const agentQuery = useQuery({
    queryKey: ["agent-metrics-by-agent"],
    queryFn: async () => (await api.get("/agents/metrics/by-agent")).data,
  });
  const recentExecutionQuery = useQuery({
    queryKey: ["recent-executions"],
    queryFn: async () => (await api.get("/agents/metrics/recent?limit=10")).data,
  });
  const evaluationQuery = useQuery({
    queryKey: ["evaluation-overview"],
    queryFn: async () => (await api.get("/evaluations/metrics/overview")).data,
  });
  const evaluatorQuery = useQuery({
    queryKey: ["evaluation-evaluators"],
    queryFn: async () => (await api.get("/evaluations/metrics/evaluators")).data,
  });
  const datasetQuery = useQuery({
    queryKey: ["evaluation-datasets"],
    queryFn: async () => (await api.get("/evaluations/metrics/datasets")).data,
  });
  const recentEvaluationQuery = useQuery({
    queryKey: ["recent-evaluations"],
    queryFn: async () => (await api.get("/evaluations/metrics/recent?limit=10")).data,
  });
  const reliabilityQuery = useQuery({
    queryKey: ["evaluation-reliability"],
    queryFn: async () => (await api.get("/evaluations/metrics/reliability?limit=30")).data,
  });

  const execution = executionQuery.data || {};
  const evaluation = evaluationQuery.data || {};
  const agents = rows(agentQuery.data);
  const recentExecutions = rows(recentExecutionQuery.data);
  const evaluators = rows(evaluatorQuery.data);
  const datasets = rows(datasetQuery.data);
  const recentEvaluations = rows(recentEvaluationQuery.data);
  const reliability = reliabilityQuery.data || {};
  const accuracyTrend = rows(reliability.accuracy_trend);
  const categoryPerformance = rows(reliability.category_performance);
  const latencyAccuracy = rows(reliability.latency_accuracy);
  const agentReliability = rows(reliability.agent_reliability);

  const loading = executionQuery.isLoading || evaluationQuery.isLoading;
  const allQueries = [
    executionQuery, agentQuery, recentExecutionQuery, evaluationQuery,
    evaluatorQuery, datasetQuery, recentEvaluationQuery, reliabilityQuery,
  ];
  const refreshAll = () => allQueries.forEach((query) => query.refetch());

  const executionStatusData = useMemo(() => [
    { name: "Completed", value: Number(execution.completed_executions || 0) },
    { name: "Failed", value: Number(execution.failed_executions || 0) },
  ], [execution]);

  const evaluatorData = evaluators.map((item) => ({
    name: item.evaluator,
    averageScore: Number(item.average_score || 0) * 100,
    totalCases: Number(item.total_cases || 0),
    passedCases: Number(item.passed_cases || 0),
    failedCases: Number(item.failed_cases || 0),
  }));

  const datasetData = datasets.filter((item) => Number(item.total_evaluation_runs || 0) > 0);
  const maxDuration = Number(execution.maximum_duration_ms || 0);

  return (
    <div className="page-stack analytics-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="status-dot" />OBSERVABILITY</div>
          <h1>Agent Analytics</h1>
          <p>Understand execution reliability, benchmark quality and performance across your AI agents.</p>
        </div>
        <button className="secondary-button" onClick={refreshAll} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />Refresh data
        </button>
      </section>

      {(executionQuery.error || evaluationQuery.error || reliabilityQuery.error) && (
        <div className="error-panel">
          <AlertCircle size={20} />
          <div><strong>Some analytics data could not be loaded</strong><p>Check the affected sections below and retry.</p></div>
          <button className="secondary-button" onClick={refreshAll}>Retry</button>
        </div>
      )}

      <section className="analytics-section">
        <div className="analytics-section-title">
          <div><span className="eyebrow">EXECUTION MONITORING</span><h2>Agent execution health</h2></div>
          <Activity size={19} className="muted-icon" />
        </div>
        <div className="analytics-metrics-grid">
          {loading ? Array.from({ length: 4 }).map((_, index) => <div className="panel" key={index}><LoadingPanel /></div>) : <>
            <MetricCard label="Total executions" value={execution.total_executions ?? 0} description="All recorded agent runs" icon={Activity} />
            <MetricCard label="Success rate" value={`${execution.success_rate ?? 0}%`} description={`${execution.completed_executions ?? 0} completed`} icon={CheckCircle2} tone="green" />
            <MetricCard label="Failed executions" value={execution.failed_executions ?? 0} description="Recorded execution failures" icon={XCircle} tone="red" />
            <MetricCard label="Average latency" value={`${execution.average_duration_ms ?? 0} ms`} description={`Maximum: ${maxDuration} ms`} icon={Clock3} tone="blue" />
          </>}
        </div>
      </section>

      <section className="analytics-section">
        <div className="analytics-section-title">
          <div><span className="eyebrow">BENCHMARK QUALITY</span><h2>Evaluation reliability</h2></div>
          <ShieldCheck size={19} className="muted-icon" />
        </div>
        <div className="analytics-metrics-grid">
          <MetricCard label="Evaluation runs" value={evaluation.total_evaluation_runs ?? 0} description="Persisted benchmark runs" icon={FlaskConical} />
          <MetricCard label="Cases evaluated" value={evaluation.total_cases_evaluated ?? 0} description="Across all evaluation runs" icon={Database} />
          <MetricCard label="Weighted accuracy" value={`${evaluation.weighted_accuracy ?? 0}%`} description="Passed cases divided by all evaluated cases" icon={CheckCircle2} tone="green" />
          <MetricCard label="Failed cases" value={evaluation.total_failed_cases ?? 0} description={`${evaluation.total_passed_cases ?? 0} passed cases`} icon={XCircle} tone="red" />
        </div>
      </section>

      <section className="analytics-chart-grid">
        <article className="panel analytics-chart-panel">
          <PanelHeading title="Execution status" description="Distribution of completed and failed executions" icon={Activity} />
          {executionQuery.isLoading ? <LoadingPanel /> : executionQuery.error ? <ErrorMessage error={executionQuery.error} /> : Number(execution.total_executions || 0) === 0 ? <EmptyMessage message="No agent executions recorded yet." /> : <>
            <div className="analytics-donut-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={executionStatusData} dataKey="value" nameKey="name" innerRadius="63%" outerRadius="84%" paddingAngle={4} stroke="none">
                  <Cell fill={colors.green} /><Cell fill={colors.red} />
                </Pie><Tooltip content={<ChartTooltip />} /></PieChart>
              </ResponsiveContainer>
              <div className="analytics-donut-center"><strong>{execution.total_executions}</strong><span>Executions</span></div>
            </div>
            <div className="analytics-legend">
              <span><i className="legend-green" />Completed<strong>{execution.completed_executions ?? 0}</strong></span>
              <span><i className="legend-red" />Failed<strong>{execution.failed_executions ?? 0}</strong></span>
            </div>
          </>}
        </article>

        <article className="panel analytics-chart-panel">
          <PanelHeading title="Evaluation accuracy trend" description="Accuracy across recent agent and manual evaluation runs" icon={TrendingUp} />
          {reliabilityQuery.isLoading ? <LoadingPanel /> : reliabilityQuery.error ? <ErrorMessage error={reliabilityQuery.error} /> : accuracyTrend.length === 0 ? <EmptyMessage message="No evaluation runs available yet." /> : (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={accuracyTrend} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                  <defs><linearGradient id="advancedAccuracyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors.green} stopOpacity={0.3} /><stop offset="95%" stopColor={colors.green} stopOpacity={0.01} /></linearGradient></defs>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" vertical={false} />
                  <XAxis dataKey="evaluation_id" tickFormatter={(value) => `#${value}`} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="accuracy" name="Accuracy" unit="%" stroke={colors.green} strokeWidth={2.5} fill="url(#advancedAccuracyFill)" activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {accuracyTrend.length > 0 && <div className="analytics-breakdown-list">{accuracyTrend.slice(-5).reverse().map((run) => <div key={run.evaluation_id}><span>Run #{run.evaluation_id} · {run.agent_name}</span><small>{run.total_cases} cases · {run.accuracy}% accuracy</small></div>)}</div>}
        </article>
      </section>

      <section className="analytics-advanced-grid">
        <article className="panel analytics-chart-panel">
          <PanelHeading title="Category reliability" description="Pass and fail counts grouped by test-case category" icon={ShieldCheck} />
          {reliabilityQuery.isLoading ? <LoadingPanel /> : reliabilityQuery.error ? <ErrorMessage error={reliabilityQuery.error} /> : categoryPerformance.length === 0 ? <EmptyMessage message="No evaluated test-case categories yet." /> : <>
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryPerformance} margin={{ top: 10, right: 8, left: -18, bottom: 4 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" vertical={false} />
                  <XAxis dataKey="category" tick={{ fill: "var(--text-muted)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} /><Legend />
                  <Bar dataKey="passed_cases" name="Passed" stackId="cases" fill={colors.green} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="failed_cases" name="Failed" stackId="cases" fill={colors.red} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="analytics-category-list">{categoryPerformance.map((item) => <div className="analytics-category-row" key={item.category}>
              <div><strong>{item.category.replaceAll("_", " ")}</strong><span>{item.total_cases} evaluated</span></div>
              <b>{item.pass_rate}% pass rate</b>
            </div>)}</div>
          </>}
        </article>

        <article className="panel analytics-chart-panel">
          <PanelHeading title="Latency vs. accuracy" description="Average agent response time against evaluation accuracy per run" icon={Clock3} />
          {reliabilityQuery.isLoading ? <LoadingPanel /> : reliabilityQuery.error ? <ErrorMessage error={reliabilityQuery.error} /> : latencyAccuracy.length === 0 ? <EmptyMessage message="No linked execution and evaluation records yet. Run an agent benchmark to populate this chart." /> : <>
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 14, left: -12, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" />
                  <XAxis type="number" dataKey="average_latency_ms" name="Average latency" unit=" ms" tick={{ fill: "var(--text-muted)", fontSize: 9 }} label={{ value: "Average latency (ms)", position: "insideBottom", offset: -4, fill: "var(--text-muted)", fontSize: 10 }} />
                  <YAxis type="number" dataKey="accuracy" name="Accuracy" unit="%" domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
                  <ZAxis type="number" dataKey="total_cases" range={[70, 260]} name="Test cases" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length ? <div className="analytics-tooltip"><strong>Evaluation #{payload[0].payload.evaluation_id}</strong><div><span>Agent</span><b>{payload[0].payload.agent_name}</b></div><div><span>Accuracy</span><b>{payload[0].payload.accuracy}%</b></div><div><span>Avg. latency</span><b>{payload[0].payload.average_latency_ms} ms</b></div><div><span>Linked executions</span><b>{payload[0].payload.linked_executions}</b></div></div> : null} />
                  <Scatter name="Evaluation runs" data={latencyAccuracy} fill={colors.blue} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="analytics-chart-note">Each point represents an evaluation run with linked agent executions. Larger points represent more test cases.</div>
          </>}
        </article>
      </section>

      <section className="panel analytics-table-panel">
        <PanelHeading title="Agent reliability comparison" description="Benchmark accuracy and case outcomes grouped by agent" icon={Bot} />
        {reliabilityQuery.isLoading ? <LoadingPanel /> : reliabilityQuery.error ? <ErrorMessage error={reliabilityQuery.error} /> : agentReliability.length === 0 ? <EmptyMessage message="No agent-linked evaluation runs yet. Manual evaluations are excluded from this comparison." /> : (
          <div className="analytics-reliability-grid">{agentReliability.map((agent) => <article className="analytics-reliability-card" key={agent.agent_name}>
            <strong>{agent.agent_name}</strong>
            <div className="analytics-reliability-values"><span>Average run accuracy</span><b>{agent.average_run_accuracy}%</b></div>
            <div className="analytics-reliability-track"><span style={{ width: `${clamp(agent.average_run_accuracy)}%` }} /></div>
            <div className="analytics-reliability-values"><span>Weighted case accuracy</span><b>{agent.weighted_accuracy}%</b></div>
            <div className="analytics-reliability-meta"><span>{agent.evaluation_runs} runs</span><span>{agent.total_cases} cases</span><span>{agent.passed_cases} passed</span><span>{agent.failed_cases} failed</span></div>
          </article>)}</div>
        )}
      </section>

      <section className="panel analytics-table-panel">
        <PanelHeading title="Agent comparison" description="Compare execution volume, reliability and average latency" icon={Bot} />
        {agentQuery.isLoading ? <LoadingPanel /> : agentQuery.error ? <ErrorMessage error={agentQuery.error} /> : agents.length === 0 ? <EmptyMessage message="No agent metrics available." /> : (
          <div className="table-scroll"><table><thead><tr><th>Agent</th><th>Executions</th><th>Completed</th><th>Failed</th><th>Success rate</th><th>Avg. latency</th></tr></thead>
            <tbody>{agents.map((agent) => <tr key={agent.agent_name}>
              <td className="primary-cell">{agent.agent_name}</td><td className="numeric">{agent.total_executions}</td><td className="numeric">{agent.completed_executions}</td><td className="numeric">{agent.failed_executions}</td><td className="numeric"><span className="analytics-success-value">{agent.success_rate}%</span></td><td className="numeric">{agent.average_duration_ms} ms</td>
            </tr>)}</tbody></table></div>
        )}
      </section>

      <section className="analytics-chart-grid">
        <article className="panel analytics-chart-panel">
          <PanelHeading title="Evaluator comparison" description="Average evaluation score by strategy" icon={FlaskConical} />
          {evaluatorQuery.isLoading ? <LoadingPanel /> : evaluatorQuery.error ? <ErrorMessage error={evaluatorQuery.error} /> : evaluatorData.length === 0 ? <EmptyMessage message="No evaluator results available." /> : <>
            <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={evaluatorData} margin={{ top: 12, right: 12, left: -18, bottom: 4 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="averageScore" name="Average score" fill={colors.green} radius={[6, 6, 0, 0]} />
            </BarChart></ResponsiveContainer></div>
            <div className="analytics-breakdown-list">{evaluatorData.map((item) => <div key={item.name}><span>{item.name}</span><small>{item.totalCases} cases · {item.passedCases} passed · {item.failedCases} failed</small></div>)}</div>
          </>}
        </article>
        <article className="panel analytics-chart-panel">
          <PanelHeading title="Dataset performance" description="Average accuracy by evaluated dataset" icon={Database} />
          {datasetQuery.isLoading ? <LoadingPanel /> : datasetQuery.error ? <ErrorMessage error={datasetQuery.error} /> : datasets.length === 0 ? <EmptyMessage message="No dataset metrics available." /> : <div className="analytics-dataset-list">{datasets.map((dataset) => {
            const runs = Number(dataset.total_evaluation_runs || 0);
            const accuracy = Number(dataset.average_accuracy || 0);
            return <div className="analytics-dataset-item" key={dataset.dataset_id}>
              <div className="analytics-dataset-heading"><div><strong>{dataset.dataset_name || `Dataset #${dataset.dataset_id}`}</strong><small>{runs} evaluation {runs === 1 ? "run" : "runs"}</small></div>{runs > 0 ? <strong className="analytics-dataset-score">{accuracy}%</strong> : <span className="analytics-not-evaluated">Not evaluated</span>}</div>
              {runs > 0 && <div className="analytics-progress-track"><span style={{ width: `${clamp(accuracy)}%` }} /></div>}
            </div>;
          })}</div>}
        </article>
      </section>

      <section className="analytics-table-grid">
        <article className="panel analytics-table-panel">
          <PanelHeading title="Recent executions" description="Latest recorded agent activity" icon={Activity} />
          {recentExecutionQuery.isLoading ? <LoadingPanel /> : recentExecutionQuery.error ? <ErrorMessage error={recentExecutionQuery.error} /> : recentExecutions.length === 0 ? <EmptyMessage message="No recent executions." /> : <div className="analytics-activity-list">{recentExecutions.map((item) => <div className="analytics-activity-item" key={item.id}>
            <div className="analytics-activity-icon"><Bot size={16} /></div><div className="analytics-activity-main"><strong>{item.agent_name}</strong><span>{formatDate(item.executed_at)}</span></div><div className="analytics-activity-meta"><StatusPill status={item.status} /><small>{item.duration_ms} ms</small></div>
          </div>)}</div>}
        </article>
        <article className="panel analytics-table-panel">
          <PanelHeading title="Recent evaluations" description="Latest benchmark results" icon={FlaskConical} />
          {recentEvaluationQuery.isLoading ? <LoadingPanel /> : recentEvaluationQuery.error ? <ErrorMessage error={recentEvaluationQuery.error} /> : recentEvaluations.length === 0 ? <EmptyMessage message="No recent evaluations." /> : <div className="analytics-activity-list">{recentEvaluations.map((item) => <div className="analytics-activity-item" key={item.id}>
            <div className="analytics-activity-icon"><FlaskConical size={16} /></div><div className="analytics-activity-main"><strong>Evaluation #{item.id}</strong><span>{item.agent_name || `Dataset #${item.dataset_id}`} · {item.total_cases} cases</span></div><div className="analytics-activity-meta"><strong className="analytics-activity-score">{item.accuracy}%</strong><StatusPill status={item.status} /></div>
          </div>)}</div>}
        </article>
      </section>

      <section className="analytics-footnote"><Database size={15} /><p>Analytics are calculated from persisted execution and evaluation records. Latency comparisons include only benchmark runs whose individual test-case results link to agent executions. Accuracy trends use evaluation run IDs as their ordering axis because evaluation runs do not currently store creation timestamps.</p></section>
    </div>
  );
}
