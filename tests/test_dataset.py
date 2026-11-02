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


def sample_dataset():
    return {
        "name": "Customer Support Dataset",
        "description": "Evaluation cases for customer support agents",
    }


def sample_test_case():
    return {
        "name": "Refund Policy Test",
        "description": "Check refund policy responses",
        "category": "accuracy",
        "expected_prompt": "What is the refund policy?",
        "expected_output": "Customers can request a refund within 30 days.",
    }


def test_create_dataset(client):
    response = client.post(
        "/api/datasets/",
        json=sample_dataset(),
    )

    assert response.status_code == 201
    assert response.json()["id"] == 1
    assert response.json()["name"] == "Customer Support Dataset"


def test_list_datasets(client):
    client.post("/api/datasets/", json=sample_dataset())

    response = client.get("/api/datasets/")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_dataset(client):
    client.post("/api/datasets/", json=sample_dataset())

    response = client.get("/api/datasets/1")

    assert response.status_code == 200
    assert response.json()["id"] == 1


def test_get_missing_dataset(client):
    response = client.get("/api/datasets/999")

    assert response.status_code == 404


def test_add_test_case_to_dataset(client):
    dataset_response = client.post(
        "/api/datasets/",
        json=sample_dataset(),
    )

    test_case_response = client.post(
        "/api/test-cases/",
        json=sample_test_case(),
    )

    assert dataset_response.status_code == 201
    assert test_case_response.status_code == 201

    response = client.post(
        "/api/datasets/1/test-cases/1",
    )

    assert response.status_code == 200
    assert response.json()["test_case_ids"] == [1]


def test_add_missing_test_case_to_dataset(client):
    client.post("/api/datasets/", json=sample_dataset())

    response = client.post(
        "/api/datasets/1/test-cases/999",
    )

    assert response.status_code == 404