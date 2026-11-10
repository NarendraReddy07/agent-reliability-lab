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


def create_run(db, dataset, test_cases, scores):
    results = []
    for case in test_cases:
        score = scores[case.id]
        passed = score >= 0.8
        results.append(EvaluationCaseResult(
            test_case_id=case.id,
            actual_output="test output",
            expected_output="expected output",
            score=score,
            passed=passed,
            evaluator="similarity",
            details="Regression comparison fixture",
        ))

    total = len(results)
    passed_count = sum(result.passed for result in results)
    run = EvaluationRun(
        dataset_id=dataset.id,
        agent_name="Mock Support Agent",
        total_cases=total,
        passed_cases=passed_count,
        failed_cases=total - passed_count,
        accuracy=round(passed_count / total * 100, 2),
        status="completed",
        case_results=results,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def seed_runs(baseline_scores, current_scores):
    db = TestingSessionLocal()
    dataset = Dataset(
        name="Regression dataset",
        description="Dataset for regression comparison tests",
    )
    cases = [
        TestCaseModel(
            name="Refund test",
            description="Refund response test",
            category="accuracy",
            expected_prompt="What is the refund policy?",
            expected_output="Expected refund response",
        ),
        TestCaseModel(
            name="Shipping test",
            description="Shipping response test",
            category="accuracy",
            expected_prompt="How long does shipping take?",
            expected_output="Expected shipping response",
        ),
        TestCaseModel(
            name="Returns test",
            description="Returns response test",
            category="accuracy",
            expected_prompt="What is the return policy?",
            expected_output="Expected returns response",
        ),
    ]
    dataset.test_cases = cases
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    baseline = create_run(
        db, dataset, cases,
        {case.id: baseline_scores[index] for index, case in enumerate(cases)},
    )
    current = create_run(
        db, dataset, cases,
        {case.id: current_scores[index] for index, case in enumerate(cases)},
    )
    ids = baseline.id, current.id
    db.close()
    return ids


def test_comparison_detects_regressions_and_improvements(client):
    baseline_id, current_id = seed_runs(
        [1.0, 0.4, 1.0],
        [0.2, 0.9, 1.0],
    )
    response = client.get(f"/api/evaluations/{current_id}/comparison")

    assert response.status_code == 200
    data = response.json()
    assert data["comparison_available"] is True
    assert data["baseline_evaluation_id"] == baseline_id
    assert data["summary"]["regressions"] == 1
    assert data["summary"]["improvements"] == 1
    assert data["summary"]["unchanged"] == 1
    assert data["regressions"][0]["test_case_name"] == "Refund test"
    assert data["improvements"][0]["test_case_name"] == "Shipping test"


def test_comparison_detects_score_degradation_without_failure(client):
    _, current_id = seed_runs(
        [0.98, 0.95, 0.90],
        [0.81, 0.95, 0.90],
    )
    response = client.get(f"/api/evaluations/{current_id}/comparison")

    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["regressions"] == 0
    assert data["summary"]["score_degradations"] == 1
    degradation = data["score_degradations"][0]
    assert degradation["test_case_name"] == "Refund test"
    assert degradation["previous_passed"] is True
    assert degradation["current_passed"] is True
    assert degradation["score_delta"] == -0.17


def test_comparison_detects_score_improvement(client):
    _, current_id = seed_runs(
        [0.81, 0.95, 0.90],
        [0.98, 0.95, 0.90],
    )
    response = client.get(f"/api/evaluations/{current_id}/comparison")

    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["score_improvements"] == 1
    assert data["score_improvements"][0]["score_delta"] == 0.17


def test_comparison_without_baseline(client):
    _, current_id = seed_runs(
        [1.0, 0.4, 1.0],
        [1.0, 0.9, 1.0],
    )
    db = TestingSessionLocal()
    db.query(EvaluationRun).filter(EvaluationRun.id != current_id).delete()
    db.commit()
    db.close()

    response = client.get(f"/api/evaluations/{current_id}/comparison")
    assert response.status_code == 200
    assert response.json()["comparison_available"] is False


def test_comparison_missing_evaluation(client):
    response = client.get("/api/evaluations/999/comparison")
    assert response.status_code == 404
