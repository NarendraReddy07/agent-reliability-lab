from fastapi import FastAPI

from backend.app.database import Base, engine
from backend.app.api.test_cases import router as test_cases_router
from backend.app.api.datasets import router as datasets_router
from backend.app.api.evaluations import router as evaluations_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Agent Reliability Lab",
    description="AI Agent Evaluation and Observability Platform",
    version="0.3.0",
)

app.include_router(test_cases_router)
app.include_router(datasets_router)
app.include_router(evaluations_router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to Agent Reliability Lab",
        "status": "running",
        "version": "0.3.0",
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "agent-reliability-lab",
    }