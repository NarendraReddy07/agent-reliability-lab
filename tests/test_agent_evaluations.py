
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


def create_sample_dataset(client):
    test_case = client.post(
        "/api/test-cases/",
        json={
            "name": "Refund Policy Test",
            "description": "Check the refund policy response",
            "category": "accuracy",
            "expected_prompt": "What is your refund policy?",
            "expected_output": (
                "Customers can request a refund within 30 days."
            ),
        },
    )

    assert test_case.status_code == 201

    dataset = client.post(
        "/api/datasets/",
        json={
            "name": "Agent Evaluation Dataset",
            "description": "Dataset for testing agent evaluation",
        },
    )

    assert dataset.status_code == 201

    association = client.post(
        "/api/datasets/1/test-cases/1"
    )

    assert association.status_code == 200

    return dataset.json()["id"]


def test_agent_evaluation_success(client):
    dataset_id = create_sample_dataset(client)

    response = client.post(
        "/api/evaluations/agent",
        json={
            "dataset_id": dataset_id,
            "agent_name": "Mock Support Agent",
            "evaluator": "exact_match",
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["dataset_id"] == dataset_id
    assert data["total_cases"] == 1
    assert data["passed_cases"] == 1
    assert data["failed_cases"] == 0
    assert data["accuracy"] == 100.0
    assert data["status"] == "completed"


def test_agent_evaluation_creates_execution_record(client):
    dataset_id = create_sample_dataset(client)

    response = client.post(
        "/api/evaluations/agent",
        json={
            "dataset_id": dataset_id,
            "agent_name": "Mock Support Agent",
            "evaluator": "exact_match",
        },
    )

    assert response.status_code == 201

    executions = client.get(
        "/api/agents/executions"
    )

    assert executions.status_code == 200
    assert len(executions.json()) == 1
    assert executions.json()[0]["status"] == "completed"


def test_agent_evaluation_saves_case_results(client):
    dataset_id = create_sample_dataset(client)

    response = client.post(
        "/api/evaluations/agent",
        json={
            "dataset_id": dataset_id,
            "agent_name": "Mock Support Agent",
            "evaluator": "exact_match",
        },
    )

    evaluation_id = response.json()["id"]

    details = client.get(
        f"/api/evaluations/{evaluation_id}/results"
    )

    assert details.status_code == 200

    data = details.json()

    assert len(data["case_results"]) == 1
    assert data["case_results"][0]["passed"] is True
    assert data["case_results"][0]["score"] == 1.0


def test_agent_evaluation_unknown_agent(client):
    dataset_id = create_sample_dataset(client)

    response = client.post(
        "/api/evaluations/agent",
        json={
            "dataset_id": dataset_id,
            "agent_name": "Unknown Agent",
            "evaluator": "exact_match",
        },
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"]


def test_agent_evaluation_missing_dataset(client):
    response = client.post(
        "/api/evaluations/agent",
        json={
            "dataset_id": 99999,
            "agent_name": "Mock Support Agent",
            "evaluator": "exact_match",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Dataset not found."


def test_agent_evaluation_empty_dataset(client):
    dataset = client.post(
        "/api/datasets/",
        json={
            "name": "Empty Dataset",
            "description": "Dataset without test cases",
        },
    )

    response = client.post(
        "/api/evaluations/agent",
        json={
            "dataset_id": dataset.json()["id"],
            "agent_name": "Mock Support Agent",
            "evaluator": "exact_match",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Dataset contains no test cases."
    )