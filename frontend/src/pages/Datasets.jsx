import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Database,
  FilePlus2,
  FolderPlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import api, { getApiError } from "../lib/api";

const categories = [
  "accuracy",
  "tool_usage",
  "safety",
  "instruction_following",
];

const emptyDataset = {
  name: "",
  description: "",
};

const emptyTestCase = {
  name: "",
  description: "",
  category: "accuracy",
  expected_prompt: "",
  expected_output: "",
};

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <section
        className="modal-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function DatasetForm({ onSubmit, loading, onCancel }) {
  const [form, setForm] = useState(emptyDataset);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      className="dataset-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <label>
        Dataset name
        <input
          required
          minLength={3}
          maxLength={120}
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="e.g. Customer Support Benchmark"
        />
      </label>

      <label>
        Description
        <textarea
          required
          minLength={5}
          maxLength={500}
          rows={4}
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
          placeholder="Describe what this dataset evaluates..."
        />
      </label>

      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button className="primary-button" disabled={loading}>
          <Plus size={16} />
          {loading ? "Creating..." : "Create dataset"}
        </button>
      </div>
    </form>
  );
}

function TestCaseForm({ onSubmit, loading, onCancel }) {
  const [form, setForm] = useState(emptyTestCase);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      className="dataset-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <label>
        Test case name
        <input
          required
          minLength={3}
          maxLength={120}
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="e.g. Refund policy response"
        />
      </label>

      <label>
        Description
        <textarea
          required
          minLength={5}
          maxLength={500}
          rows={2}
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
          placeholder="What does this test case verify?"
        />
      </label>

      <label>
        Category
        <select
          value={form.category}
          onChange={(event) => update("category", event.target.value)}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <label>
        Expected prompt
        <textarea
          required
          maxLength={5000}
          rows={3}
          value={form.expected_prompt}
          onChange={(event) => update("expected_prompt", event.target.value)}
          placeholder="Enter the prompt sent to the agent..."
        />
      </label>

      <label>
        Expected output
        <textarea
          required
          maxLength={5000}
          rows={3}
          value={form.expected_output}
          onChange={(event) => update("expected_output", event.target.value)}
          placeholder="Enter the expected response..."
        />
      </label>

      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button className="primary-button" disabled={loading}>
          <FilePlus2 size={16} />
          {loading ? "Creating..." : "Create test case"}
        </button>
      </div>
    </form>
  );
}

export default function Datasets() {
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modal, setModal] = useState(null);

  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: async () => (await api.get("/datasets/")).data,
  });

  const testCasesQuery = useQuery({
    queryKey: ["test-cases"],
    queryFn: async () => (await api.get("/test-cases/")).data,
  });

  const datasets = datasetsQuery.data ?? [];
  const testCases = testCasesQuery.data ?? [];

  const selectedDataset = datasets.find(
    (dataset) => dataset.id === selectedId
  );

  const filteredDatasets = useMemo(() => {
    const term = search.trim().toLowerCase();

    return datasets.filter((dataset) =>
      `${dataset.name} ${dataset.description}`.toLowerCase().includes(term)
    );
  }, [datasets, search]);

  const assignedIds = new Set(selectedDataset?.test_case_ids ?? []);

  const availableCases = testCases.filter((testCase) => {
    const matchesCategory =
      categoryFilter === "all" || testCase.category === categoryFilter;

    return matchesCategory && !assignedIds.has(testCase.id);
  });

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: ["datasets"] });
    queryClient.invalidateQueries({ queryKey: ["test-cases"] });
  };

  const createDataset = useMutation({
    mutationFn: async (data) => (await api.post("/datasets/", data)).data,
    onSuccess: (dataset) => {
      invalidateData();
      setSelectedId(dataset.id);
      setModal(null);
      toast.success("Dataset created successfully");
    },
    onError: (error) => toast.error(getApiError(error)),
  });

  const deleteDataset = useMutation({
    mutationFn: async (datasetId) => {
      await api.delete(`/datasets/${datasetId}`);
      return datasetId;
    },
    onSuccess: async (deletedId) => {
      if (selectedId === deletedId) {
        setSelectedId(null);
      }

      await queryClient.invalidateQueries({ queryKey: ["datasets"] });
      await queryClient.invalidateQueries({ queryKey: ["test-cases"] });

      toast.success("Dataset deleted successfully");
    },
    onError: (error) => {
      toast.error(getApiError(error));
    },
  });

  const createTestCase = useMutation({
    mutationFn: async (data) => (await api.post("/test-cases/", data)).data,
    onSuccess: async (testCase) => {
      await queryClient.invalidateQueries({ queryKey: ["test-cases"] });

      if (selectedId !== null) {
        try {
          await api.post(
            `/datasets/${selectedId}/test-cases/${testCase.id}`
          );

          await queryClient.invalidateQueries({ queryKey: ["datasets"] });
          toast.success("Test case created and added to dataset");
        } catch (error) {
          toast.error(
            `Test case created, but could not be added: ${getApiError(error)}`
          );
        }
      } else {
        toast.success("Test case created successfully");
      }

      setModal(null);
    },
    onError: (error) => toast.error(getApiError(error)),
  });

  const addTestCase = useMutation({
    mutationFn: async (testCaseId) =>
      (
        await api.post(
          `/datasets/${selectedId}/test-cases/${testCaseId}`
        )
      ).data,
    onSuccess: () => {
      invalidateData();
      toast.success("Test case added to dataset");
    },
    onError: (error) => toast.error(getApiError(error)),
  });

  const removeTestCase = useMutation({
    mutationFn: async (testCaseId) =>
      (
        await api.delete(
          `/datasets/${selectedId}/test-cases/${testCaseId}`
        )
      ).data,
    onSuccess: () => {
      invalidateData();
      toast.success("Test case removed from dataset");
    },
    onError: (error) => toast.error(getApiError(error)),
  });

  function handleDeleteDataset(dataset) {
    const confirmed = window.confirm(
      `Delete "${dataset.name}"?\n\n` +
      "Its evaluation history and dataset associations will be deleted. " +
      "The reusable test cases will remain in your library. " +
      "This action cannot be undone."
    );

    if (confirmed) {
      deleteDataset.mutate(dataset.id);
    }
  }

  if (datasetsQuery.isLoading || testCasesQuery.isLoading) {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <div>
            <div className="eyebrow">WORKSPACE</div>
            <h1>Dataset Management</h1>
            <p>Loading your datasets and test-case library...</p>
          </div>
        </div>

        <section className="panel dataset-loading">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-value" />
          <div className="skeleton skeleton-line" />
        </section>
      </div>
    );
  }

  if (datasetsQuery.error || testCasesQuery.error) {
    const error = datasetsQuery.error || testCasesQuery.error;

    return (
      <div className="page-stack">
        <div className="page-heading">
          <div>
            <div className="eyebrow">WORKSPACE</div>
            <h1>Dataset Management</h1>
          </div>

          <button
            className="secondary-button"
            onClick={() => {
              datasetsQuery.refetch();
              testCasesQuery.refetch();
            }}
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>

        <div className="panel error-panel">
          <AlertCircle size={22} />
          <div>
            <strong>Unable to load dataset information</strong>
            <p>{getApiError(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack dataset-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            EVALUATION WORKSPACE
          </div>
          <h1>Dataset Management</h1>
          <p>Build, organize, and manage your agent evaluation datasets.</p>
        </div>

        <div className="dataset-heading-actions">
          <button
            className="secondary-button"
            onClick={() => {
              datasetsQuery.refetch();
              testCasesQuery.refetch();
            }}
          >
            <RefreshCw size={16} /> Refresh
          </button>

          <button
            className="primary-button"
            onClick={() => setModal("dataset")}
          >
            <FolderPlus size={16} /> New dataset
          </button>
        </div>
      </section>

      <section className="dataset-summary-grid">
        <div className="panel dataset-summary-card">
          <Database size={20} />
          <span>Total datasets</span>
          <strong>{datasets.length}</strong>
        </div>

        <div className="panel dataset-summary-card">
          <FilePlus2 size={20} />
          <span>Test-case library</span>
          <strong>{testCases.length}</strong>
        </div>

        <div className="panel dataset-summary-card">
          <Check size={20} />
          <span>Assigned test cases</span>
          <strong>
            {datasets.reduce(
              (total, dataset) =>
                total + (dataset.test_case_ids?.length ?? 0),
              0
            )}
          </strong>
        </div>
      </section>

      <section className="dataset-workspace">
        <div className="panel dataset-browser">
          <div className="panel-heading">
            <div>
              <h2>Your datasets</h2>
              <p>{datasets.length} datasets in your workspace</p>
            </div>
            <Database size={19} className="muted-icon" />
          </div>

          <div className="dataset-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search datasets..."
              aria-label="Search datasets"
            />
          </div>

          <div className="dataset-list">
            {filteredDatasets.map((dataset) => (
              <button
                key={dataset.id}
                className={`dataset-list-item ${
                  selectedId === dataset.id ? "active" : ""
                }`}
                onClick={() => setSelectedId(dataset.id)}
              >
                <div className="dataset-list-icon">
                  <Database size={18} />
                </div>

                <div className="dataset-list-info">
                  <strong>{dataset.name}</strong>
                  <span>
                    {dataset.test_case_ids?.length ?? 0} test cases
                  </span>
                </div>

                <ChevronRight size={17} />
              </button>
            ))}

            {filteredDatasets.length === 0 && (
              <div className="dataset-empty-small">
                {datasets.length === 0
                  ? "No datasets created yet."
                  : "No datasets match your search."}
              </div>
            )}
          </div>
        </div>

        <div className="panel dataset-detail">
          {!selectedDataset ? (
            <div className="empty-state dataset-select-empty">
              <Database size={30} />
              <strong>Select a dataset</strong>
              <span>
                Choose a dataset from the list to manage its test cases.
              </span>

              <button
                className="primary-button"
                onClick={() => setModal("dataset")}
              >
                <Plus size={16} /> Create dataset
              </button>
            </div>
          ) : (
            <>
              <div className="dataset-detail-heading">
                <div>
                  <div className="eyebrow">
                    DATASET #{selectedDataset.id}
                  </div>
                  <h2>{selectedDataset.name}</h2>
                  <p>{selectedDataset.description}</p>
                </div>

                <span className="dataset-count">
                  {selectedDataset.test_case_ids?.length ?? 0} test cases
                </span>
              </div>

              <div className="dataset-detail-actions">
                <button
                  className="secondary-button"
                  onClick={() => setModal("test-case")}
                >
                  <FilePlus2 size={16} /> New test case
                </button>

                <button
                  className="secondary-button"
                  onClick={() => handleDeleteDataset(selectedDataset)}
                  disabled={deleteDataset.isPending}
                  style={{
                    color: "var(--danger, #ef4444)",
                    borderColor: "var(--danger, #ef4444)",
                  }}
                >
                  <Trash2 size={16} />
                  {deleteDataset.isPending ? "Deleting..." : "Delete dataset"}
                </button>
              </div>

              <div className="dataset-section">
                <div className="dataset-section-heading">
                  <div>
                    <h3>Assigned test cases</h3>
                    <p>Test cases currently included in this dataset.</p>
                  </div>
                </div>

                {testCases.filter((item) => assignedIds.has(item.id))
                  .length === 0 ? (
                  <div className="dataset-empty-state">
                    <FilePlus2 size={24} />
                    <strong>This dataset is empty</strong>
                    <span>Add test cases from the library below.</span>
                  </div>
                ) : (
                  <div className="assigned-case-list">
                    {testCases
                      .filter((item) => assignedIds.has(item.id))
                      .map((testCase) => (
                        <article
                          className="assigned-case"
                          key={testCase.id}
                        >
                          <div className="assigned-case-info">
                            <div className="assigned-case-title">
                              <strong>{testCase.name}</strong>
                              <span className="category-chip">
                                {testCase.category?.replaceAll("_", " ")}
                              </span>
                            </div>

                            <p>{testCase.description}</p>

                            <span className="case-id">
                              Test case #{testCase.id}
                            </span>
                          </div>

                          <button
                            className="icon-button danger"
                            title="Remove from dataset"
                            aria-label={`Remove ${testCase.name} from dataset`}
                            disabled={removeTestCase.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove "${testCase.name}" from this dataset? ` +
                                  "The test case will remain in your library."
                                )
                              ) {
                                removeTestCase.mutate(testCase.id);
                              }
                            }}
                          >
                            <Trash2 size={17} />
                          </button>
                        </article>
                      ))}
                  </div>
                )}
              </div>

              <div className="dataset-section">
                <div className="dataset-section-heading">
                  <div>
                    <h3>Test-case library</h3>
                    <p>Add existing test cases to this dataset.</p>
                  </div>

                  <select
                    className="category-filter"
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(event.target.value)
                    }
                    aria-label="Filter by category"
                  >
                    <option value="all">All categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                {availableCases.length === 0 ? (
                  <div className="dataset-empty-state compact">
                    <Check size={22} />
                    <strong>No available test cases</strong>
                    <span>
                      All matching test cases are assigned, or the library is
                      empty.
                    </span>
                  </div>
                ) : (
                  <div className="library-case-list">
                    {availableCases.map((testCase) => (
                      <article
                        className="library-case"
                        key={testCase.id}
                      >
                        <div className="assigned-case-info">
                          <div className="assigned-case-title">
                            <strong>{testCase.name}</strong>
                            <span className="category-chip">
                              {testCase.category?.replaceAll("_", " ")}
                            </span>
                          </div>

                          <p>{testCase.description}</p>

                          <span className="case-id">
                            Test case #{testCase.id}
                          </span>
                        </div>

                        <button
                          className="secondary-button add-case-button"
                          disabled={addTestCase.isPending}
                          onClick={() => addTestCase.mutate(testCase.id)}
                        >
                          <Plus size={15} /> Add
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {modal === "dataset" && (
        <Modal
          title="Create dataset"
          onClose={() => setModal(null)}
        >
          <DatasetForm
            loading={createDataset.isPending}
            onCancel={() => setModal(null)}
            onSubmit={(data) => createDataset.mutate(data)}
          />
        </Modal>
      )}

      {modal === "test-case" && (
        <Modal
          title="Create test case"
          onClose={() => setModal(null)}
        >
          <TestCaseForm
            loading={createTestCase.isPending}
            onCancel={() => setModal(null)}
            onSubmit={(data) => createTestCase.mutate(data)}
          />
        </Modal>
      )}
    </div>
  );
}