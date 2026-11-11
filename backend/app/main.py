import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from backend.app.api.agents import router as agents_router
from backend.app.api.datasets import router as datasets_router
from backend.app.api.evaluations import router as evaluations_router
from backend.app.api.schedules import router as schedules_router
from backend.app.api.test_cases import router as test_cases_router
from backend.app.database import Base, engine
from backend.app import scheduled_models  # noqa: F401
from backend.app.scheduler import benchmark_scheduler_loop


Base.metadata.create_all(bind=engine)


def migrate_evaluation_linkage():
    """Add nullable linkage columns to existing databases."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "evaluation_runs" in tables:
        columns = {
            column["name"]
            for column in inspector.get_columns("evaluation_runs")
        }
        if "agent_name" not in columns:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE evaluation_runs "
                        "ADD COLUMN agent_name VARCHAR(120)"
                    )
                )

    if "evaluation_case_results" in tables:
        columns = {
            column["name"]
            for column in inspector.get_columns(
                "evaluation_case_results"
            )
        }
        if "execution_id" not in columns:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE evaluation_case_results "
                        "ADD COLUMN execution_id INTEGER "
                        "REFERENCES agent_executions(id)"
                    )
                )


migrate_evaluation_linkage()


scheduler_enabled = os.getenv(
    "ENABLE_SCHEDULER", "true"
).strip().lower() in {"1", "true", "yes", "on"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler_task = None

    if scheduler_enabled:
        scheduler_task = asyncio.create_task(
            benchmark_scheduler_loop()
        )

    try:
        yield
    finally:
        if scheduler_task is not None:
            scheduler_task.cancel()
            try:
                await scheduler_task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="Agent Reliability Lab",
    description="AI Agent Evaluation and Observability Platform",
    version="0.5.0",
    lifespan=lifespan,
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(test_cases_router)
app.include_router(datasets_router)
app.include_router(evaluations_router)
app.include_router(agents_router)
app.include_router(schedules_router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to Agent Reliability Lab",
        "status": "running",
        "version": "0.5.0",
    }


@app.get("/api/health")
async def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        ) from exc

    return {
        "status": "healthy",
        "service": "agent-reliability-lab",
        "database": "connected",
    }