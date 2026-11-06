
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db


TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


@pytest.fixture()
def client():
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()

        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


def execute_agent(client, prompt):
    return client.post(
        "/api/agents/Mock Support Agent/execute",
        json={"prompt": prompt},
    )


def test_empty_execution_metrics(client):
    response = client.get("/api/agents/metrics")

    assert response.status_code == 200

    data = response.json()

    assert data["total_executions"] == 0
    assert data["completed_executions"] == 0
    assert data["failed_executions"] == 0
    assert data["success_rate"] == 0.0


def test_execution_metrics(client):
    execute_agent(client, "What is your refund policy?")
    execute_agent(client, "What are your shipping details?")

    response = client.get("/api/agents/metrics")

    assert response.status_code == 200

    data = response.json()

    assert data["total_executions"] == 2
    assert data["completed_executions"] == 2
    assert data["failed_executions"] == 0
    assert data["success_rate"] == 100.0
    assert data["average_duration_ms"] >= 0


def test_agent_grouped_metrics(client):
    execute_agent(client, "What is your refund policy?")
    execute_agent(client, "What are your shipping details?")

    response = client.get(
        "/api/agents/metrics/by-agent"
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["agent_name"] == "Mock Support Agent"
    assert data[0]["total_executions"] == 2
    assert data[0]["completed_executions"] == 2
    assert data[0]["failed_executions"] == 0
    assert data[0]["success_rate"] == 100.0


def test_recent_executions(client):
    execute_agent(client, "What is your refund policy?")
    execute_agent(client, "What are your shipping details?")

    response = client.get(
        "/api/agents/metrics/recent"
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 2
    assert data[0]["id"] > data[1]["id"]


def test_recent_executions_limit(client):
    response = client.get(
        "/api/agents/metrics/recent?limit=2"
    )

    assert response.status_code == 200
    assert len(response.json()) == 0


def test_recent_executions_invalid_limit(client):
    response = client.get(
        "/api/agents/metrics/recent?limit=0"
    )

    assert response.status_code == 422