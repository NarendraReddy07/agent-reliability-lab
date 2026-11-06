import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import api, { getApiError } from "../lib/api";

function getRows(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function getAgentName(agent) {
  if (typeof agent === "string") return agent;

  return (
    agent?.name ||
    agent?.agent_name ||
    agent?.id ||
    ""
  );
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString();
}

function StatusBadge({ passed }) {
  return (
    <span className={`evaluation-status ${passed ? "passed" : "failed"}`}>
      {passed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {passed ? "Passed" : "Failed"}
    </span>
  );
}

function MetricCard({ label, value, icon: Icon, tone = "" }) {
  return (
    <div className="evaluation-metric panel">
      <div className={`evaluation-metric-icon ${tone}`}>
        <Icon size={19} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function CaseResult({ result, index }) {
  const [expanded, setExpanded] = useState(false);

  const score = Number(result.score ?? 0);
  const percentage = Math.max(0, Math.min(100, score * 100));

  return (
    <article className="evaluation-case panel">
      <button
        className="evaluation-case-toggle"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <div className="evaluation-case-leading">
          <span className="evaluation-case-number">
            {String(index + 1).padStart(2, "0")}
          </span>

          <div className="evaluation-case-title">
            <strong>{result.test_case_name || `Test case ${index + 1}`}</strong>
            <span>
              Test case #{result.test_case_id ?? "—"} ·{" "}
              {result.evaluator || "Evaluator unavailable"}
            </span>
          </div>
        </div>

        <div className="evaluation-case-trailing">
          <div className="evaluation-score">
            <strong>{percentage.toFixed(1)}%</strong>
            <span>Score</span>
          </div>

          <StatusBadge passed={result.passed} />

          {expanded ? (
            <ChevronDown size={17} />
          ) : (
            <ChevronRight size={17} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="evaluation-case-details">
          <div className="evaluation-output-grid">
            <div className="evaluation-output">
              <div className="evaluation-output-heading">
                <span>Expected output</span>
                <CheckCircle2 size={15} />
              </div>
              <p>{result.expected_output || "No expected output recorded."}</p>
            </div>

            <div className="evaluation-output actual">
              <div className="evaluation-output-heading">
                <span>Actual agent output</span>
                <Activity size={15} />
              </div>
              <p>{result.actual_output || "No actual output recorded."}</p>
            </div>
          </div>

          <div className="evaluation-explanation">
            <div>
              <ShieldAlert size={16} />
              <strong>Evaluator explanation</strong>
            </div>
            <p>{result.details || "No evaluation explanation available."}</p>
          </div>
        </div>
      )}
    </article>
  );
}

export default function Evaluations() {
  const queryClient = useQueryClient();

  const [datasetId, setDatasetId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [evaluator, setEvaluator] = useState("similarity");
  const [selectedEvaluationId, setSelectedEvaluationId] = useState(null);
  const [caseFilter, setCaseFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: async () => (await api.get("/agents/")).data,
  });

  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: async () => (await api.get("/datasets/")).data,
  });

  const historyQuery = useQuery({
    queryKey: ["evaluations"],
    queryFn: async () => (await api.get("/evaluations/")).data,
  });

  const agents = getRows(agentsQuery.data, ["agents", "items"]);
  const datasets = getRows(datasetsQuery.data, ["datasets", "items"]);
  const history = getRows(historyQuery.data, ["evaluations", "items"]);

  const selectedDataset = datasets.find(
    (dataset) => String(dataset.id) === String(datasetId)
  );

  const selectedEvaluation = history.find(
    (item) => String(item.id) === String(selectedEvaluationId)
  );

  const detailQuery = useQuery({
    queryKey: ["evaluation-results", selectedEvaluationId],
    queryFn: async () =>
      (
        await api.get(
          `/evaluations/${selectedEvaluationId}/results`
        )
      ).data,
    enabled: selectedEvaluationId !== null,
  });

  const details = detailQuery.data;
  const caseResults = details?.case_results || [];

  const filteredResults = useMemo(() => {
    return caseResults.filter((result) => {
      const matchesFilter =
        caseFilter === "all" ||
        (caseFilter === "passed" && result.passed) ||
        (caseFilter === "failed" && !result.passed);

      const matchesSearch =
        !searchTerm ||
        result.test_case_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [caseResults, caseFilter, searchTerm]);

  useEffect(() => {
    if (history.length > 0 && selectedEvaluationId === null) {
      setSelectedEvaluationId(history[0].id);
    }
  }, [history, selectedEvaluationId]);

  useEffect(() => {
    if (!agentName && agents.length > 0) {
      setAgentName(getAgentName(agents[0]));
    }
  }, [agents, agentName]);

  useEffect(() => {
    if (!datasetId && datasets.length > 0) {
      setDatasetId(String(datasets[0].id));
    }
  }, [datasets, datasetId]);

  const runMutation = useMutation({
    mutationFn: async (payload) =>
      (await api.post("/evaluations/agent", payload)).data,

    onSuccess: async (data) => {
      toast.success("Evaluation completed successfully.");

      await queryClient.invalidateQueries({
        queryKey: ["evaluations"],
      });

      if (data?.id !== undefined && data?.id !== null) {
        setSelectedEvaluationId(data.id);
      } else {
        const refreshed = await api.get("/evaluations/");
        const rows = getRows(refreshed.data, ["evaluations", "items"]);

        if (rows.length > 0) {
          setSelectedEvaluationId(rows[0].id);
        }
      }
    },

    onError: (error) => {
      toast.error(getApiError(error));
    },
  });

  const handleRun = (event) => {
    event.preventDefault();

    if (!datasetId || !agentName || !evaluator) {
      toast.error("Select an agent, dataset and evaluation strategy.");
      return;
    }

    runMutation.mutate({
      dataset_id: Number(datasetId),
      agent_name: agentName,
      evaluator,
    });
  };

  const refreshAll = async () => {
    await Promise.all([
      agentsQuery.refetch(),
      datasetsQuery.refetch(),
      historyQuery.refetch(),
      detailQuery.refetch(),
    ]);
  };

  const summary = details || selectedEvaluation || {};

  const totalCases = Number(summary.total_cases ?? 0);
  const passedCases = Number(summary.passed_cases ?? 0);
  const failedCases = Number(summary.failed_cases ?? 0);
  const accuracy = Number(summary.accuracy ?? 0);

  const isInitialLoading =
    agentsQuery.isLoading ||
    datasetsQuery.isLoading ||
    historyQuery.isLoading;

  const pageError =
    agentsQuery.error ||
    datasetsQuery.error ||
    historyQuery.error;

  return (
    <div className="page-stack evaluations-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            QUALITY ASSURANCE
          </div>
          <h1>Evaluations</h1>
          <p>
            Benchmark your AI agents, inspect their performance and identify
            reliability gaps.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={refreshAll}
          disabled={isInitialLoading}
        >
          <RefreshCw
            size={16}
            className={isInitialLoading ? "spin" : ""}
          />
          Refresh
        </button>
      </section>

      {pageError && (
        <div className="error-panel">
          <AlertCircle size={21} />
          <div>
            <strong>Unable to load evaluation workspace</strong>
            <p>{getApiError(pageError)}</p>
          </div>
        </div>
      )}

      <section className="panel evaluation-launcher">
        <div className="evaluation-section-heading">
          <div>
            <div className="eyebrow">NEW BENCHMARK</div>
            <h2>Run an evaluation</h2>
            <p>Choose an agent and dataset to start a benchmark run.</p>
          </div>

          <div className="evaluation-launcher-icon">
            <Play size={20} />
          </div>
        </div>

        <form onSubmit={handleRun} className="evaluation-form">
          <label>
            <span>AI agent</span>
            <select
              value={agentName}
              onChange={(event) => setAgentName(event.target.value)}
              disabled={agentsQuery.isLoading || agents.length === 0}
            >
              {agents.length === 0 && (
                <option value="">No agents available</option>
              )}

              {agents.map((agent, index) => {
                const name = getAgentName(agent);

                return (
                  <option key={`${name}-${index}`} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            <span>Benchmark dataset</span>
            <select
              value={datasetId}
              onChange={(event) => setDatasetId(event.target.value)}
              disabled={datasetsQuery.isLoading || datasets.length === 0}
            >
              {datasets.length === 0 && (
                <option value="">No datasets available</option>
              )}

              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>

            {selectedDataset && (
              <small>
                {selectedDataset.test_case_ids?.length ?? 0} test cases
              </small>
            )}
          </label>

          <label>
            <span>Evaluation strategy</span>
            <select
              value={evaluator}
              onChange={(event) => setEvaluator(event.target.value)}
            >
              <option value="similarity">Text similarity</option>
              <option value="exact_match">Exact match</option>
              <option value="keyword_match">Keyword match</option>
            </select>
          </label>

          <button
            className="primary-button evaluation-run-button"
            type="submit"
            disabled={
              runMutation.isPending ||
              agents.length === 0 ||
              datasets.length === 0
            }
          >
            {runMutation.isPending ? (
              <>
                <RefreshCw size={16} className="spin" />
                Running benchmark...
              </>
            ) : (
              <>
                <Play size={16} />
                Run evaluation
              </>
            )}
          </button>
        </form>
      </section>

      <section className="evaluation-workspace">
        <aside className="panel evaluation-history">
          <div className="panel-heading">
            <div>
              <h2>Evaluation history</h2>
              <p>{history.length} recorded runs</p>
            </div>
            <Clock3 size={18} className="muted-icon" />
          </div>

          {historyQuery.isLoading ? (
            <div className="resource-loading">
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-value" />
              <div className="skeleton skeleton-line" />
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <FileText size={25} />
              <strong>No evaluation runs yet</strong>
              <span>Run your first benchmark to see its results here.</span>
            </div>
          ) : (
            <div className="evaluation-history-list">
              {history.map((item) => {
                const active =
                  String(item.id) === String(selectedEvaluationId);

                return (
                  <button
                    key={item.id}
                    className={`evaluation-history-item ${active ? "active" : ""}`}
                    onClick={() => {
                      setSelectedEvaluationId(item.id);
                      setCaseFilter("all");
                      setSearchTerm("");
                    }}
                  >
                    <div className="evaluation-history-top">
                      <strong>Run #{item.id}</strong>
                      <span
                        className={`evaluation-history-status ${item.status}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="evaluation-history-stats">
                      <span>{item.accuracy ?? 0}% accuracy</span>
                      <span>
                        {item.passed_cases ?? 0}/{item.total_cases ?? 0} passed
                      </span>
                    </div>

                    <div className="evaluation-history-progress">
                      <span
                        style={{
                          width: `${Math.max(0, Math.min(100, Number(item.accuracy ?? 0)))}%`,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="evaluation-detail">
          {selectedEvaluationId === null ? (
            <section className="panel evaluation-placeholder">
              <Activity size={30} />
              <h2>Select an evaluation</h2>
              <p>
                Choose a run from the history to inspect its benchmark results.
              </p>
            </section>
          ) : detailQuery.isLoading ? (
            <section className="panel evaluation-placeholder">
              <RefreshCw size={24} className="spin" />
              <p>Loading evaluation results...</p>
            </section>
          ) : detailQuery.error ? (
            <section className="panel error-panel">
              <AlertCircle size={21} />
              <div>
                <strong>Unable to load detailed results</strong>
                <p>{getApiError(detailQuery.error)}</p>
              </div>
            </section>
          ) : details ? (
            <>
              <section className="evaluation-result-heading">
                <div>
                  <div className="eyebrow">BENCHMARK REPORT</div>
                  <h2>Evaluation #{details.id}</h2>
                  <p>
                    Dataset #{details.dataset_id} ·{" "}
                    {details.status || "Unknown status"}
                  </p>
                </div>

                <span className="evaluation-completed">
                  <CheckCircle2 size={14} />
                  {details.status || "Completed"}
                </span>
              </section>

              <section className="evaluation-metrics-grid">
                <MetricCard
                  label="Accuracy"
                  value={`${accuracy}%`}
                  icon={Activity}
                  tone="green"
                />
                <MetricCard
                  label="Total cases"
                  value={totalCases}
                  icon={Database}
                />
                <MetricCard
                  label="Passed"
                  value={passedCases}
                  icon={CheckCircle2}
                  tone="green"
                />
                <MetricCard
                  label="Failed"
                  value={failedCases}
                  icon={XCircle}
                  tone="red"
                />
              </section>

              <section className="panel evaluation-results-panel">
                <div className="panel-heading evaluation-results-toolbar">
                  <div>
                    <h2>Test case results</h2>
                    <p>
                      Inspect individual responses and evaluator feedback.
                    </p>
                  </div>

                  <div className="evaluation-search">
                    <Search size={15} />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search test cases"
                    />
                  </div>
                </div>

                <div className="evaluation-filter-row">
                  {[
                    ["all", `All (${caseResults.length})`],
                    ["passed", `Passed (${passedCases})`],
                    ["failed", `Failed (${failedCases})`],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`evaluation-filter ${caseFilter === value ? "active" : ""}`}
                      onClick={() => setCaseFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {detailQuery.data.case_results?.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={25} />
                    <strong>No case results</strong>
                    <span>This evaluation has no recorded test-case results.</span>
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="empty-state">
                    <Search size={25} />
                    <strong>No matching test cases</strong>
                    <span>Try changing your search or result filter.</span>
                  </div>
                ) : (
                  <div className="evaluation-case-list">
                    {filteredResults.map((result, index) => (
                      <CaseResult
                        key={result.id}
                        result={result}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="panel evaluation-placeholder">
              <AlertCircle size={25} />
              <p>No evaluation details are available.</p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}