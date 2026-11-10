import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, CalendarClock, CheckCircle2, Clock3, Edit3, Pause, Play,
  Plus, RefreshCw, ShieldCheck, Trash2, XCircle
} from "lucide-react";
import { toast } from "sonner";
import api, { getApiError } from "../lib/api";
import "./Schedules.css";

const EMPTY_FORM = {
  name: "",
  dataset_id: "",
  agent_name: "Mock Support Agent",
  evaluator: "similarity",
  interval_minutes: 60,
  minimum_accuracy: 95,
  max_regressions: 0,
  max_score_degradations: 0,
  require_baseline: false,
  is_active: true,
};

function formatDate(value) {
  if (!value) return "Not run yet";
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function parseReport(value) {
  if (!value) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function StatusPill({ schedule }) {
  const status = schedule.last_status || (schedule.is_active ? "scheduled" : "paused");
  const pass = schedule.last_quality_decision === "pass";
  const failed = status === "failed" || schedule.last_quality_decision === "fail";
  const label = failed ? "Needs attention" : pass ? "Quality passed" : status.replaceAll("_", " ");
  return <span className={`schedule-pill ${failed ? "is-danger" : pass ? "is-success" : "is-neutral"}`}>{label}</span>;
}

function ScheduleForm({ initial, datasets, onCancel, onSave, saving }) {
  const [form, setForm] = useState(() => initial || EMPTY_FORM);
  const [formError, setFormError] = useState("");

  function update(key, value) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function submit(event) {
    event.preventDefault();
    setFormError("");
    if (!form.name.trim()) return setFormError("Enter a schedule name.");
    if (!form.dataset_id) return setFormError("Select a dataset.");
    if (Number(form.interval_minutes) < 1) return setFormError("Interval must be at least one minute.");
    onSave({
      ...form,
      dataset_id: Number(form.dataset_id),
      interval_minutes: Number(form.interval_minutes),
      minimum_accuracy: Number(form.minimum_accuracy),
      max_regressions: Number(form.max_regressions),
      max_score_degradations: Number(form.max_score_degradations),
    });
  }

  return (
    <form className="schedule-form" onSubmit={submit}>
      <div className="schedule-form-heading">
        <div><span className="schedule-eyebrow">{initial ? "EDIT AUTOMATION" : "NEW AUTOMATION"}</span><h2>{initial ? "Update schedule" : "Create a benchmark schedule"}</h2></div>
        <button type="button" className="schedule-icon-button" onClick={onCancel} aria-label="Close form"><XCircle size={19} /></button>
      </div>
      <div className="schedule-form-grid">
        <label className="schedule-field schedule-field-wide">Schedule name
          <input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Daily support benchmark" maxLength={120} required />
        </label>
        <label className="schedule-field">Dataset
          <select value={form.dataset_id} onChange={e => update("dataset_id", e.target.value)} required>
            <option value="">Choose a dataset</option>
            {datasets.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.name} (#{dataset.id})</option>)}
          </select>
        </label>
        <label className="schedule-field">Agent
          <input value={form.agent_name} onChange={e => update("agent_name", e.target.value)} required />
        </label>
        <label className="schedule-field">Evaluator
          <select value={form.evaluator} onChange={e => update("evaluator", e.target.value)}>
            <option value="similarity">Similarity</option><option value="exact_match">Exact match</option><option value="keyword_match">Keyword match</option>
          </select>
        </label>
        <label className="schedule-field">Run every (minutes)
          <input type="number" min="1" max="10080" value={form.interval_minutes} onChange={e => update("interval_minutes", e.target.value)} required />
        </label>
        <label className="schedule-field">Minimum accuracy (%)
          <input type="number" min="0" max="100" step="0.1" value={form.minimum_accuracy} onChange={e => update("minimum_accuracy", e.target.value)} />
        </label>
        <label className="schedule-field">Maximum regressions
          <input type="number" min="0" value={form.max_regressions} onChange={e => update("max_regressions", e.target.value)} />
        </label>
        <label className="schedule-field">Maximum score degradations
          <input type="number" min="0" value={form.max_score_degradations} onChange={e => update("max_score_degradations", e.target.value)} />
        </label>
      </div>
      <label className="schedule-check"><input type="checkbox" checked={Boolean(form.require_baseline)} onChange={e => update("require_baseline", e.target.checked)} /> Require a comparable baseline before passing the quality gate</label>
      {formError && <p className="schedule-form-error">{formError}</p>}
      <div className="schedule-form-actions"><button type="button" className="schedule-button secondary" onClick={onCancel}>Cancel</button><button className="schedule-button primary" disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : "Create schedule"}</button></div>
    </form>
  );
}

export default function Schedules() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);

  const schedulesQuery = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => (await api.get("/schedules/")).data,
    refetchInterval: 15000,
  });
  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: async () => (await api.get("/datasets/")).data,
  });

  const schedules = schedulesQuery.data || [];
  const datasets = datasetsQuery.data || [];
  const stats = useMemo(() => ({
    total: schedules.length,
    active: schedules.filter(item => item.is_active).length,
    passed: schedules.filter(item => item.last_quality_decision === "pass").length,
    failed: schedules.filter(item => item.last_status === "failed" || item.last_quality_decision === "fail").length,
  }), [schedules]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["schedules"] });

  const createMutation = useMutation({
    mutationFn: payload => api.post("/schedules/", payload),
    onSuccess: () => { toast.success("Benchmark schedule created"); setShowForm(false); refresh(); },
    onError: error => toast.error(getApiError(error)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/schedules/${id}`, payload),
    onSuccess: () => { toast.success("Schedule updated"); setEditing(null); setShowForm(false); refresh(); },
    onError: error => toast.error(getApiError(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/schedules/${id}`),
    onSuccess: () => { toast.success("Schedule deleted"); setSelected(null); refresh(); },
    onError: error => toast.error(getApiError(error)),
  });

  function save(payload) {
    if (editing) updateMutation.mutate({ id: editing.id, payload });
    else createMutation.mutate(payload);
  }

  function toggleSchedule(schedule) {
    updateMutation.mutate({ id: schedule.id, payload: { is_active: !schedule.is_active } });
  }

  function openEdit(schedule) {
    setEditing({ ...schedule, dataset_id: String(schedule.dataset_id) });
    setShowForm(true);
  }

  if (schedulesQuery.isLoading) return <main className="schedules-page"><div className="schedules-header-skeleton" /><div className="schedules-stat-grid">{[1,2,3,4].map(item => <div className="schedule-skeleton" key={item} />)}</div><div className="schedule-skeleton schedule-skeleton-table" /></main>;

  if (schedulesQuery.isError) return <main className="schedules-page"><div className="schedule-error-state"><XCircle size={30} /><h2>Couldn't load schedules</h2><p>{getApiError(schedulesQuery.error)}</p><button className="schedule-button primary" onClick={() => schedulesQuery.refetch()}><RefreshCw size={16} /> Retry</button></div></main>;

  return (
    <main className="schedules-page">
      <header className="schedules-header">
        <div><span className="schedule-eyebrow">AUTOMATION CENTER</span><h1>Scheduled benchmarks</h1><p>Run evaluations automatically and catch reliability regressions before they reach production.</p></div>
        <div className="schedules-header-actions"><button className="schedule-button secondary" onClick={() => refresh()}><RefreshCw size={16} /> Refresh</button><button className="schedule-button primary" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={17} /> New schedule</button></div>
      </header>

      <section className="schedules-stat-grid" aria-label="Schedule summary">
        <div className="schedule-stat"><span className="schedule-stat-icon"><CalendarClock size={18} /></span><span className="schedule-stat-label">Total schedules</span><strong>{stats.total}</strong><small>Configured automations</small></div>
        <div className="schedule-stat"><span className="schedule-stat-icon"><Activity size={18} /></span><span className="schedule-stat-label">Active</span><strong>{stats.active}</strong><small>Currently enabled</small></div>
        <div className="schedule-stat"><span className="schedule-stat-icon"><CheckCircle2 size={18} /></span><span className="schedule-stat-label">Quality passed</span><strong>{stats.passed}</strong><small>Latest quality decision</small></div>
        <div className="schedule-stat"><span className="schedule-stat-icon"><XCircle size={18} /></span><span className="schedule-stat-label">Needs attention</span><strong>{stats.failed}</strong><small>Failed runs or quality gates</small></div>
      </section>

      {showForm && <ScheduleForm initial={editing} datasets={datasets} saving={createMutation.isPending || updateMutation.isPending} onCancel={() => { setShowForm(false); setEditing(null); }} onSave={save} />}

      <section className="schedules-list-section">
        <div className="schedules-section-heading"><div><h2>Your schedules</h2><p>Automatically refreshed every 15 seconds</p></div><span className="schedule-live-indicator"><i /> Live updates</span></div>
        {schedules.length === 0 ? <div className="schedule-empty-state"><CalendarClock size={32} /><h3>No schedules yet</h3><p>Create your first recurring benchmark to monitor an agent over time.</p><button className="schedule-button primary" onClick={() => setShowForm(true)}><Plus size={16} /> Create first schedule</button></div> :
          <div className="schedule-card-list">
            {schedules.map(schedule => {
              const report = parseReport(schedule.last_quality_report);
              return <article className={`schedule-card ${selected === schedule.id ? "is-selected" : ""}`} key={schedule.id}>
                <div className="schedule-card-main">
                  <div className="schedule-card-title-row"><div className="schedule-card-icon"><CalendarClock size={19} /></div><div className="schedule-card-title"><h3>{schedule.name}</h3><p>{schedule.agent_name} <span>·</span> Dataset #{schedule.dataset_id} <span>·</span> {schedule.evaluator}</p></div><StatusPill schedule={schedule} /></div>
                  <div className="schedule-card-metrics">
                    <div><small>Frequency</small><strong>Every {schedule.interval_minutes} min</strong></div>
                    <div><small>Last run</small><strong>{formatDate(schedule.last_run_at)}</strong></div>
                    <div><small>Next run</small><strong>{schedule.is_active ? formatDate(schedule.next_run_at) : "Paused"}</strong></div>
                    <div><small>Last evaluation</small><strong>{schedule.last_evaluation_id ? `#${schedule.last_evaluation_id}` : "—"}</strong></div>
                  </div>
                  {schedule.last_error && <p className="schedule-inline-error">{schedule.last_error}</p>}
                  {report && <div className="schedule-quality-summary"><ShieldCheck size={16} /><span>{report.checks?.minimum_accuracy?.message || `Quality gate: ${report.decision || schedule.last_quality_decision}`}</span><span className="schedule-quality-accuracy">{report.accuracy ?? report.metrics?.accuracy ?? ""}{report.accuracy ? "%" : ""}</span></div>}
                  <div className="schedule-card-footer"><span className={schedule.is_active ? "schedule-active-label" : "schedule-paused-label"}>{schedule.is_active ? <><Play size={13} /> Active</> : <><Pause size={13} /> Paused</>}</span><div className="schedule-actions"><button className="schedule-text-button" onClick={() => setSelected(selected === schedule.id ? null : schedule.id)}>{selected === schedule.id ? "Hide details" : "Details"}</button><button className="schedule-icon-button" onClick={() => openEdit(schedule)} aria-label={`Edit ${schedule.name}`}><Edit3 size={16} /></button><button className="schedule-icon-button" onClick={() => toggleSchedule(schedule)} aria-label={schedule.is_active ? "Pause schedule" : "Activate schedule"}>{schedule.is_active ? <Pause size={16} /> : <Play size={16} />}</button><button className="schedule-icon-button danger" onClick={() => { if (window.confirm(`Delete "${schedule.name}"? This cannot be undone.`)) deleteMutation.mutate(schedule.id); }} aria-label={`Delete ${schedule.name}`}><Trash2 size={16} /></button></div></div>
                  {selected === schedule.id && <div className="schedule-details"><div><small>Minimum accuracy</small><strong>{schedule.minimum_accuracy}%</strong></div><div><small>Max regressions</small><strong>{schedule.max_regressions}</strong></div><div><small>Max score degradations</small><strong>{schedule.max_score_degradations}</strong></div><div><small>Baseline required</small><strong>{schedule.require_baseline ? "Yes" : "No"}</strong></div><div><small>Last quality decision</small><strong>{schedule.last_quality_decision || "Not available"}</strong></div><div><small>Last status</small><strong>{schedule.last_status || "Scheduled"}</strong></div></div>}
                </div>
              </article>;
            })}
          </div>}
      </section>
    </main>
  );
}
