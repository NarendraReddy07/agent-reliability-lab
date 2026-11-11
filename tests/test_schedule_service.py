from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import Base
from backend.app.models import Dataset, TestCase
from backend.app.scheduled_models import ScheduledBenchmark
from backend.app.services.schedule_service import (
    recover_abandoned_schedules,
    run_due_schedules,
)


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    dataset = Dataset(
        name="Scheduler test dataset",
        description="Dataset for scheduler service tests",
    )
    dataset.test_cases = [
        TestCase(
            name="Test case",
            description="Scheduler test case",
            category="accuracy",
            expected_prompt="Test prompt",
            expected_output="Test expected output",
        )
    ]

    session.add(dataset)
    session.commit()
    session.refresh(dataset)

    yield session, dataset

    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def create_schedule(db, dataset, **overrides):
    now = datetime.utcnow()

    values = {
        "name": "Scheduler test",
        "dataset_id": dataset.id,
        "agent_name": "Mock Support Agent",
        "evaluator": "similarity",
        "interval_minutes": 60,
        "minimum_accuracy": 95.0,
        "max_regressions": 0,
        "max_score_degradations": 0,
        "require_baseline": False,
        "is_active": True,
        "next_run_at": now - timedelta(minutes=1),
        "last_status": "scheduled",
    }
    values.update(overrides)

    schedule = ScheduledBenchmark(**values)
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    return schedule


def test_due_schedule_executes_and_records_result(db):
    session, dataset = db
    schedule = create_schedule(session, dataset)

    fake_evaluation = type("Evaluation", (), {"id": 101})()
    fake_report = {"decision": "pass", "passed": True}

    with (
        patch(
            "backend.app.services.evaluation_service.run_agent_evaluation",
            return_value=fake_evaluation,
        ) as run_evaluation,
        patch(
            "backend.app.services.quality_gate_service.evaluate_quality_gate",
            return_value=fake_report,
        ),
    ):
        completed = run_due_schedules(session)

    session.refresh(schedule)

    assert completed == 1
    assert run_evaluation.call_count == 1
    assert schedule.last_status == "completed"
    assert schedule.last_evaluation_id == 101
    assert schedule.last_quality_decision == "pass"
    assert schedule.last_error is None
    assert schedule.next_run_at > datetime.utcnow()


def test_abandoned_schedule_is_recovered(db):
    session, dataset = db

    stale_start = datetime.utcnow() - timedelta(minutes=45)

    schedule = create_schedule(
        session,
        dataset,
        last_status="running",
        last_run_at=stale_start,
        next_run_at=datetime.utcnow() + timedelta(minutes=20),
    )

    recovered = recover_abandoned_schedules(session)
    session.refresh(schedule)

    assert recovered == 1
    assert schedule.last_status == "scheduled"
    assert schedule.next_run_at <= datetime.utcnow()
    assert "lease" in schedule.last_error.lower()


def test_recently_running_schedule_is_not_recovered(db):
    session, dataset = db

    recent_start = datetime.utcnow() - timedelta(minutes=5)

    schedule = create_schedule(
        session,
        dataset,
        last_status="running",
        last_run_at=recent_start,
        next_run_at=datetime.utcnow() + timedelta(minutes=20),
    )

    recovered = recover_abandoned_schedules(session)
    session.refresh(schedule)

    assert recovered == 0
    assert schedule.last_status == "running"


def test_paused_schedule_is_not_executed(db):
    session, dataset = db

    schedule = create_schedule(
        session,
        dataset,
        is_active=False,
    )

    with patch(
        "backend.app.services.evaluation_service.run_agent_evaluation"
    ) as run_evaluation:
        completed = run_due_schedules(session)

    session.refresh(schedule)

    assert completed == 0
    assert run_evaluation.call_count == 0
    assert schedule.last_status == "scheduled"


def test_schedule_is_not_executed_twice_on_consecutive_ticks(db):
    session, dataset = db
    schedule = create_schedule(session, dataset)

    fake_evaluation = type("Evaluation", (), {"id": 202})()

    with (
        patch(
            "backend.app.services.evaluation_service.run_agent_evaluation",
            return_value=fake_evaluation,
        ) as run_evaluation,
        patch(
            "backend.app.services.quality_gate_service.evaluate_quality_gate",
            return_value={"decision": "pass", "passed": True},
        ),
    ):
        first_count = run_due_schedules(session)
        second_count = run_due_schedules(session)

    session.refresh(schedule)

    assert first_count == 1
    assert second_count == 0
    assert run_evaluation.call_count == 1
    assert schedule.last_status == "completed"