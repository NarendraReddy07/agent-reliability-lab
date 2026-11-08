from fastapi import FastAPI

from sqlalchemy import inspect, text

from backend.app.api.agents import router as agents_router
from backend.app.database import Base, engine
from backend.app.api.test_cases import router as test_cases_router
from backend.app.api.datasets import router as datasets_router
from backend.app.api.evaluations import router as evaluations_router

Base.metadata.create_all(bind=engine)


def migrate_evaluation_linkage():
    """Add nullable linkage columns to existing SQLite databases."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "evaluation_runs" in tables:
        columns = {column["name"] for column in inspector.get_columns("evaluation_runs")}
        if "agent_name" not in columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE evaluation_runs ADD COLUMN agent_name VARCHAR(120)")
                )

    if "evaluation_case_results" in tables:
        columns = {
            column["name"]
            for column in inspector.get_columns("evaluation_case_results")
        }
        if "execution_id" not in columns:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE evaluation_case_results "
                        "ADD COLUMN execution_id INTEGER REFERENCES agent_executions(id)"
                    )
                )


migrate_evaluation_linkage()

app = FastAPI(
    title="Agent Reliability Lab",
    description="AI Agent Evaluation and Observability Platform",
    version="0.4.0",
)

app.include_router(test_cases_router)
app.include_router(datasets_router)
app.include_router(evaluations_router)
app.include_router(agents_router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to Agent Reliability Lab",
        "status": "running",
        "version": "0.4.0",
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "agent-reliability-lab",
    }