import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models import (
    Dataset,
    TestCase as TestCaseModel,
    EvaluationRun,
    EvaluationCaseResult,
)


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


def create_run(db, dataset, case, score, agent_name="Mock Support Agent"):
    passed = score >= 0.8
    result = EvaluationCaseResult(
        test_case_id=case.id,
        actual_output="output",
        expected_output="expected",
        score=score,
        passed=passed,
        evaluator="similarity",
        details="quality gate fixture",
    )
    run = EvaluationRun(
        dataset_id=dataset.id,
        agent_name=agent_name,
        total_cases=1,
        passed_cases=1 if passed else 0,
        failed_cases=0 if passed else 1,
        accuracy=100.0 if passed else 0.0,
        status="completed",
        case_results=[result],
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def seed_runs(baseline_score=1.0, current_score=1.0):
    db = TestingSessionLocal()
    dataset = Dataset(
        name="Quality gate dataset",
        description="Dataset for release quality gate tests",
    )
    case = TestCaseModel(
        name="Refund quality check",
        description="Validate refund answer",
        category="accuracy",
        expected_prompt="Refund policy?",
        expected_output="Expected answer",
    )
    dataset.test_cases = [case]
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    baseline = create_run(db, dataset, case, baseline_score)
    current = create_run(db, dataset, case, current_score)
    ids = baseline.id, current.id
    db.close()
    return ids


def test_quality_gate_passes_when_all_checks_pass(client):
    _, evaluation_id = seed_runs()
    response = client.get(
        f"/api/evaluations/{evaluation_id}/quality-gate"
        "?minimum_accuracy=95&max_regressions=0&max_score_degradations=0"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "pass"
    assert data["passed"] is True
    assert data["baseline_available"] is True
    assert data["failed_checks"] == []


def test_quality_gate_fails_when_accuracy_below_threshold(client):
    _, evaluation_id = seed_runs(baseline_score=1.0, current_score=0.4)
    response = client.get(
        f"/api/evaluations/{evaluation_id}/quality-gate?minimum_accuracy=95"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "fail"
    assert data["checks"]["minimum_accuracy"]["actual"] == 0.0
    assert "minimum_accuracy" in data["failed_checks"]


def test_quality_gate_fails_when_baseline_is_required_but_missing(client):
    _, evaluation_id = seed_runs()
    db = TestingSessionLocal()
    db.query(EvaluationRun).filter(EvaluationRun.id != evaluation_id).delete()
    db.commit()
    db.close()

    response = client.get(
        f"/api/evaluations/{evaluation_id}/quality-gate?require_baseline=true"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "fail"
    assert "baseline_available" in data["failed_checks"]


def test_quality_gate_rejects_manual_evaluation(client):
    db = TestingSessionLocal()
    dataset = Dataset(name="Manual dataset", description="Manual evaluation dataset")
    case = TestCaseModel(
        name="Manual case",
        description="Manual evaluation case",
        category="accuracy",
        expected_prompt="Prompt",
        expected_output="Expected",
    )
    dataset.test_cases = [case]
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    run = create_run(db, dataset, case, 1.0, agent_name=None)
    evaluation_id = run.id
    db.close()

    response = client.get(
        f"/api/evaluations/{evaluation_id}/quality-gate"
    )
    assert response.status_code == 400
    assert "agent-driven" in response.json()["detail"]


def test_quality_gate_missing_evaluation(client):
    response = client.get("/api/evaluations/999/quality-gate")
    assert response.status_code == 404
