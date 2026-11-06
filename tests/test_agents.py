
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


def execute_sample_agent(client):
    return client.post(
        "/api/agents/Mock Support Agent/execute",
        json={
            "prompt": "What is your refund policy?"
        },
    )


def test_list_agents(client):
    response = client.get("/api/agents/")

    assert response.status_code == 200

    data = response.json()

    assert len(data["agents"]) >= 1
    assert any(
        agent["name"] == "Mock Support Agent"
        for agent in data["agents"]
    )


def test_execute_agent(client):
    response = execute_sample_agent(client)

    assert response.status_code == 200

    data = response.json()

    assert data["execution_id"] is not None
    assert data["agent_name"] == "Mock Support Agent"
    assert data["output"] == (
        "Customers can request a refund within 30 days."
    )
    assert data["status"] == "completed"
    assert data["metadata"]["provider"] == "mock"


def test_execution_is_saved_in_database(client):
    execute_response = execute_sample_agent(client)

    assert execute_response.status_code == 200

    execution_id = execute_response.json()["execution_id"]

    history_response = client.get(
        "/api/agents/executions"
    )

    assert history_response.status_code == 200

    executions = history_response.json()

    assert len(executions) == 1
    assert executions[0]["id"] == execution_id
    assert executions[0]["status"] == "completed"


def test_get_execution_details_and_trace(client):
    execute_response = execute_sample_agent(client)

    assert execute_response.status_code == 200

    execution_id = execute_response.json()["execution_id"]

    response = client.get(
        f"/api/agents/executions/{execution_id}"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == execution_id
    assert data["agent_name"] == "Mock Support Agent"
    assert data["status"] == "completed"
    assert data["provider"] == "mock"

    trace_events = [
        event["event"]
        for event in data["trace"]
    ]

    assert "execution_started" in trace_events
    assert "agent_response" in trace_events
    assert "execution_completed" in trace_events


def test_execute_unknown_agent(client):
    response = client.post(
        "/api/agents/Unknown Agent/execute",
        json={
            "prompt": "Hello"
        },
    )

    assert response.status_code == 404


def test_get_missing_execution(client):
    response = client.get(
        "/api/agents/executions/99999"
    )

    assert response.status_code == 404


def test_execute_agent_without_prompt(client):
    response = client.post(
        "/api/agents/Mock Support Agent/execute",
        json={},
    )

    assert response.status_code == 422