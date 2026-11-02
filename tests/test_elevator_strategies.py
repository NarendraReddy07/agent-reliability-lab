
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db


test_engine = create_engine(
    "sqlite://",
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


def create_dataset(client):
    test_case_response = client.post(
        "/api/test-cases/",
        json={
            "name": "Refund policy accuracy",
            "description": "Verify refund policy responses",
            "category": "accuracy",
            "expected_prompt": "What is the refund policy?",
            "expected_output": (
                "Customers can request a refund within 30 days."
            ),
        },
    )

    assert test_case_response.status_code == 201
    test_case_id = test_case_response.json()["id"]

    dataset_response = client.post(
        "/api/datasets/",
        json={
            "name": "Refund benchmark",
            "description": "Tests refund policy responses",
        },
    )

    assert dataset_response.status_code == 201
    dataset_id = dataset_response.json()["id"]

    add_response = client.post(
        f"/api/datasets/{dataset_id}/test-cases/{test_case_id}"
    )
    assert add_response.status_code == 200

    return dataset_id, test_case_id


@pytest.mark.parametrize(
    "evaluator,actual_output,expected_passed",
    [
        (
            "exact_match",
            "Customers can request a refund within 30 days.",
            1,
        ),
        (
            "exact_match",
            "Refunds are available within 60 days.",
            0,
        ),
        (
            "keyword_match",
            "Within 30 days, customers can request a refund.",
            1,
        ),
        (
            "similarity",
            "Customers can request a refund within 30 days.",
            1,
        ),
    ],
)
def test_evaluation_strategies(
    client,
    evaluator,
    actual_output,
    expected_passed,
):
    dataset_id, test_case_id = create_dataset(client)

    response = client.post(
        "/api/evaluations/",
        json={
            "dataset_id": dataset_id,
            "evaluator": evaluator,
            "outputs": [
                {
                    "test_case_id": test_case_id,
                    "actual_output": actual_output,
                }
            ],
        },
    )

    assert response.status_code == 201

    data = response.json()
    assert data["passed_cases"] == expected_passed
    assert data["failed_cases"] == 1 - expected_passed


def test_evaluator_is_saved_in_case_result(client):
    dataset_id, test_case_id = create_dataset(client)

    response = client.post(
        "/api/evaluations/",
        json={
            "dataset_id": dataset_id,
            "evaluator": "exact_match",
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
    evaluation_id = response.json()["id"]

    details_response = client.get(
        f"/api/evaluations/{evaluation_id}/results"
    )

    assert details_response.status_code == 200

    case_result = details_response.json()["case_results"][0]
    assert case_result["evaluator"] == "exact_match"


def test_invalid_evaluator_is_rejected(client):
    dataset_id, test_case_id = create_dataset(client)

    response = client.post(
        "/api/evaluations/",
        json={
            "dataset_id": dataset_id,
            "evaluator": "random_method",
            "outputs": [
                {
                    "test_case_id": test_case_id,
                    "actual_output": "Some output",
                }
            ],
        },
    )

    assert response.status_code == 422