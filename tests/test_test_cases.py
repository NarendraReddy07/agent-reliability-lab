import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db


# Separate in-memory database for testing
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


def sample_test_case():
    return {
        "name": "Customer support accuracy",
        "description": "Check whether the agent answers correctly",
        "category": "accuracy",
        "expected_prompt": "What is the refund policy?",
        "expected_output": "Customers can request a refund within 30 days.",
    }


def test_create_test_case(client):
    response = client.post(
        "/api/test-cases/",
        json=sample_test_case(),
    )

    assert response.status_code == 201
    assert response.json()["id"] == 1
    assert response.json()["name"] == "Customer support accuracy"


def test_list_test_cases(client):
    client.post("/api/test-cases/", json=sample_test_case())

    response = client.get("/api/test-cases/")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_test_case(client):
    client.post("/api/test-cases/", json=sample_test_case())

    response = client.get("/api/test-cases/1")

    assert response.status_code == 200
    assert response.json()["id"] == 1


def test_invalid_category(client):
    data = sample_test_case()
    data["category"] = "invalid"

    response = client.post(
        "/api/test-cases/",
        json=data,
    )

    assert response.status_code == 422


def test_delete_test_case(client):
    client.post("/api/test-cases/", json=sample_test_case())

    response = client.delete("/api/test-cases/1")

    assert response.status_code == 204

    get_response = client.get("/api/test-cases/1")

    assert get_response.status_code == 404


def test_get_missing_test_case(client):
    response = client.get("/api/test-cases/999")

    assert response.status_code == 404