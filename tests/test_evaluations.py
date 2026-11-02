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
    test_case = {
        "name": "Refund policy accuracy",
        "description": "Verify the refund policy response",
        "category": "accuracy",
        "expected_prompt": "What is the refund policy?",
        "expected_output": "Customers can request a refund within 30 days.",
    }

    test_case_response = client.post(
        "/api/test-cases/",
        json=test_case,
    )

    assert test_case_response.status_code == 201

    dataset_response = client.post(
        "/api/datasets/",
        json={
            "name": "Customer Support Benchmark",
            "description": "Tests for customer support agents",
        },
    )

    assert dataset_response.status_code == 201

    dataset_id = dataset_response.json()["id"]
    test_case_id = test_case_response.json()["id"]

    client.post(
        f"/api/datasets/{dataset_id}/test-cases/{test_case_id}"
    )

    return dataset_id, test_case_id


def test_create_evaluation(client):
    dataset_id, test_case_id = create_sample_dataset(client)

    response = client.post(
        "/api/evaluations/",
        json={
            "dataset_id": dataset_id,
            "outputs": [
                {
                    "test_case_id": test_case_id,
                    "actual_output": (
                        "Customers can request a refund within 30 days."
                    ),
                }
            ],
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["total_cases"] == 1
    assert data["passed_cases"] == 1
    assert data["failed_cases"] == 0
    assert data["accuracy"] == 100.0
    assert data["status"] == "completed"


def test_evaluation_with_incorrect_output(client):
    dataset_id, test_case_id = create_sample_dataset(client)

    response = client.post(
        "/api/evaluations/",
        json={
            "dataset_id": dataset_id,
            "outputs": [
                {
                    "test_case_id": test_case_id,
                    "actual_output": "Refunds are not available.",
                }
            ],
        },
    )

    assert response.status_code == 201
    assert response.json()["failed_cases"] == 1
    assert response.json()["accuracy"] == 0.0


def test_evaluation_with_missing_dataset(client):
    response = client.post(
        "/api/evaluations/",
        json={
            "dataset_id": 999,
            "outputs": [
                {
                    "test_case_id": 1,
                    "actual_output": "Some output",
                }
            ],
        },
    )

    assert response.status_code == 400


def test_evaluation_with_missing_output(client):
    dataset_id, _ = create_sample_dataset(client)

    response = client.post(
        "/api/evaluations/",
        json={
            "dataset_id": dataset_id,
            "outputs": [],
        },
    )

    assert response.status_code == 422


def test_evaluation_with_duplicate_outputs(client):
    dataset_id, test_case_id = create_sample_dataset(client)

    response = client.post(
        "/api/evaluations/",
        json={
            "dataset_id": dataset_id,
            "outputs": [
                {
                    "test_case_id": test_case_id,
                    "actual_output": "First output",
                },
                {
                    "test_case_id": test_case_id,
                    "actual_output": "Second output",
                },
            ],
        },
    )

    assert response.status_code == 400


def test_list_evaluations(client):
    dataset_id, test_case_id = create_sample_dataset(client)

    client.post(
        "/api/evaluations/",
        json={
            "dataset_id": dataset_id,
            "outputs": [
                {
                    "test_case_id": test_case_id,
                    "actual_output": (
                        "Customers can request a refund within 30 days."
                    ),
                }
            ],
        },
    )

    response = client.get("/api/evaluations/")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_evaluation(client):
    dataset_id, test_case_id = create_sample_dataset(client)

    create_response = client.post(
        "/api/evaluations/",
        json={
            "dataset_id": dataset_id,
            "outputs": [
                {
                    "test_case_id": test_case_id,
                    "actual_output": (
                        "Customers can request a refund within 30 days."
                    ),
                }
            ],
        },
    )

    evaluation_id = create_response.json()["id"]

    response = client.get(
        f"/api/evaluations/{evaluation_id}"
    )

    assert response.status_code == 200
    assert response.json()["id"] == evaluation_id


def test_get_missing_evaluation(client):
    response = client.get("/api/evaluations/999")

    assert response.status_code == 404


def test_get_evaluation_detailed_results(client):
    dataset_id, test_case_id = create_sample_dataset(client)


    create_response = client.post(
        "/api/evaluations/",
        json={
            "dataset_id": dataset_id,
            "outputs": [
                {
                    "test_case_id": test_case_id,
                    "actual_output": (
                        "Customers can request a refund within 30 days."
                    ),
                }
            ],
        },
    )

    evaluation_id = create_response.json()["id"]

    response = client.get(
        f"/api/evaluations/{evaluation_id}/results"
    )

    assert response.status_code == 200 

    data = response.json()

    assert len(data["case_results"]) == 1


    case_result = data["case_results"][0]

    assert case_result["test_case_id"] == test_case_id
    assert case_result["test_case_name"] == "Refund policy accuracy"
    assert case_result["passed"] is True
    assert case_result["score"] == 1.0
    assert case_result["evaluator"] == "similarity"


def test_detailed_results_for_failed_evaluation(client):
    dataset_id, test_case_id = create_sample_dataset(client)

    create_response = client.post(
        "/api/evaluations",
        json={
            "dataset_id": dataset_id,
            "outputs": [
                {
                    "test_case_id": test_case_id,
                    "actual_output": "Refunds are not available.",
                }
            ],
        },
    )


    evaluation_id = create_response.json()["id"]

    response = client.get(
        f"/api/evaluations/{evaluation_id}/results"
    )

    assert response.status_code == 200

    case_result = response.json()["case_results"][0]

    assert case_result["passed"] is False
    assert case_result["score"] < 0.8


def test_get_missing_evaluation_detailed_results(client):
    response = client.get("/api/evaluations/999/results")

    assert response.status_code == 404