# Agent Reliability Lab

**Agent Reliability Lab** is an AI agent evaluation, benchmarking, and observability platform. It provides a repeatable way to run agent prompts against test datasets, score the resulting responses, inspect execution traces, and monitor reliability metrics.

The project currently includes a deterministic mock support agent so the evaluation and observability workflow can be developed and tested without depending on a paid LLM API.

## Project goals

- Evaluate agent responses against expected outputs using selectable evaluation strategies.
- Organize test cases into reusable datasets.
- Persist evaluation runs, per-case results, agent executions, and execution traces.
- Inspect agent inputs, outputs, status, provider/model metadata, duration, and lifecycle events.
- Compare evaluation quality across runs, datasets, evaluators, agents, and test categories.
- Explore the relationship between execution latency and evaluation accuracy.

## Current capabilities

### Test cases and datasets
- Create and manage test cases.
- Categorize cases as `accuracy`, `tool_usage`, `safety`, or `instruction_following`.
- Create datasets and assign test cases to them.
- Reuse datasets for repeatable evaluation runs.

### Agent execution
- Register and discover available agents.
- Execute an agent with a supplied prompt.
- Persist execution input, output, provider, model, status, error information, duration, and trace events.
- Inspect execution history and individual execution details.

The included **Mock Support Agent** is deterministic and intended for development and testing. It is not a production conversational model.

### Evaluation and benchmarking
- Run evaluations against a dataset.
- Run dataset prompts through a selected agent and evaluate the generated responses.
- Supported evaluation strategies:
  - `exact_match`
  - `keyword_match`
  - `similarity`
- Persist run-level summaries and per-test-case scores, pass/fail outcomes, evaluator details, and linked agent execution IDs where available.
- Inspect expected output alongside actual agent output.

### Observability and analytics
- Inspect execution lifecycle events in chronological order.
- Review execution volume, completion/failure counts, success rate, and latency.
- Review evaluation accuracy trends and weighted accuracy.
- Compare evaluator strategies and dataset performance.
- Group evaluation outcomes by test-case category.
- Compare agent reliability across benchmark runs.
- Explore latency versus accuracy for evaluation runs with linked agent executions.

Analytics are calculated from persisted application records. Sections that require linked agent executions may be empty for manual evaluations or older records that do not contain execution links.

## Technology stack

| Layer | Technologies |
|---|---|
| Backend API | Python, FastAPI, Pydantic |
| ORM and persistence | SQLAlchemy, SQLite |
| Frontend | React, Vite, JavaScript |
| Routing | React Router |
| Data fetching and caching | Axios, TanStack Query |
| Charts | Recharts |
| UI and motion | Tailwind CSS, Framer Motion, Lucide React, Sonner |
| Testing | Pytest, HTTPX |

## Architecture

```text
agent-reliability-lab/
├── backend/
│   ├── app/
│   │   ├── agents/          # Agent interface and mock agent
│   │   ├── api/             # FastAPI route modules
│   │   ├── services/        # Execution, evaluation, and metrics logic
│   │   ├── database.py      # SQLAlchemy engine and session setup
│   │   ├── models.py        # Database models
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   └── main.py          # FastAPI application
│   └── requirements.txt
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/      # Shared application layout/components
│       ├── lib/             # API client and shared utilities
│       ├── pages/           # Dashboard and workspace pages
│       ├── App.jsx
│       ├── index.css
│       └── main.jsx
├── tests/                   # Backend test suite
└── README.md
```

## Getting started

### Prerequisites

- Python 3.11
- Node.js and npm
- Git

### 1. Clone the repository

```powershell
git clone https://github.com/NarendraReddy07/agent-reliability-lab.git
cd agent-reliability-lab
```

### 2. Set up the backend

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install backend dependencies:

```powershell
python -m pip install -r backend/requirements.txt
```

Start the FastAPI server from the project root:

```powershell
python -m uvicorn backend.app.main:app --reload
```

Backend URLs:

- API root: `http://127.0.0.1:8000/`
- Health check: `http://127.0.0.1:8000/api/health`
- Interactive API documentation: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

The application creates its SQLite tables on startup. The local database file is `agent_reliability.db` and should not be committed.

### 3. Set up the frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm.cmd run dev
```

Open the frontend URL printed by Vite. The default local development URL is usually:

`http://127.0.0.1:5173`

The Vite development server proxies `/api` requests to the FastAPI backend at `http://127.0.0.1:8000`.

Build the frontend for production:

```powershell
npm.cmd run build
```

Preview the production build locally:

```powershell
npm.cmd run preview
```

## Main application pages

| Page | Purpose |
|---|---|
| Overview | High-level workspace health and recent activity |
| Agents | Registered agents, execution health, and prompt execution |
| Datasets | Dataset and test-case management |
| Evaluations | Run benchmarks and inspect per-case results |
| Analytics | Reliability, evaluation, and execution metrics |
| Executions | Search and inspect persisted agent executions |
| Traces | Inspect chronological execution lifecycle events |

## API overview

The interactive Swagger documentation at `/docs` is the authoritative, up-to-date API reference. The principal route groups include:

| Route | Purpose |
|---|---|
| `/api/health` | Backend health check |
| `/api/agents/` | List registered agents |
| `/api/agents/{agent_name}/execute` | Execute an agent with a prompt |
| `/api/agents/executions` | Retrieve execution history |
| `/api/agents/executions/{execution_id}` | Retrieve an execution and its trace |
| `/api/agents/metrics` | Overall agent execution metrics |
| `/api/agents/metrics/by-agent` | Execution metrics grouped by agent |
| `/api/agents/metrics/recent` | Recent agent executions |
| `/api/datasets/` | Dataset management |
| `/api/test-cases/` | Test-case management |
| `/api/evaluations/` | Evaluation history and evaluation creation |
| `/api/evaluations/agent` | Run an agent-driven dataset evaluation |
| `/api/evaluations/{evaluation_id}/results` | Retrieve detailed per-case evaluation results |
| `/api/evaluations/metrics/overview` | Evaluation summary metrics |
| `/api/evaluations/metrics/evaluators` | Evaluator strategy comparison |
| `/api/evaluations/metrics/datasets` | Dataset performance metrics |
| `/api/evaluations/metrics/reliability` | Accuracy trend, category performance, latency/accuracy, and agent reliability data |

Some routes accept path parameters or query parameters. Use `/docs` to inspect their exact request and response schemas.

## Running tests

Run the backend test suite from the project root:

```powershell
python -m pytest tests -v
```

## Evaluation workflow

A typical agent benchmarking workflow is:

1. Create test cases with prompts, expected outputs, and categories.
2. Group the test cases into a dataset.
3. Select a registered agent and an evaluation strategy.
4. Run an agent-driven evaluation against the dataset.
5. Inspect the evaluation summary and individual case results.
6. Follow a linked execution ID to inspect the agent input, output, metadata, and trace.
7. Review analytics to identify quality and reliability gaps.

## Data and configuration notes

- SQLite is used for local development and persistence.
- The local SQLite database is generated by the application and is excluded from version control.
- Local environment files such as `.env` must not be committed.
- The mock agent provides deterministic responses for repeatable development and test workflows.
- Latency analytics only include evaluation results that have a linked agent execution.

## Current scope and roadmap

The current implementation focuses on the evaluation and observability foundation. Potential next improvements include:

- Additional realistic benchmark datasets across all supported categories.
- Multiple agent implementations and provider integrations.
- Repeated benchmark runs to measure response consistency.
- Regression detection when evaluation quality drops.
- More detailed latency distributions and percentile metrics.
- Further deployment and production-readiness improvements.

## Contributing

1. Create a focused change.
2. Run the backend tests.
3. Build the frontend.
4. Review the Git diff and ensure local databases, virtual environments, secrets, and generated files are not included.
5. Submit changes with a clear commit message.

## License

No license has been specified yet. All rights are reserved unless and until a license is added to this repository.