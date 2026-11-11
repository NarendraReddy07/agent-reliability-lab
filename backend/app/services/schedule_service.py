import json
from datetime import datetime, timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session

from backend.app.models import Dataset
from backend.app.scheduled_models import ScheduledBenchmark
from backend.app.services.agent_service import agent_service


# A running schedule older than this is considered abandoned.
# This is deliberately longer than the normal mock benchmark execution time.
SCHEDULE_LEASE_MINUTES = 30


def create_schedule(db: Session, payload) -> ScheduledBenchmark:
    dataset = (
        db.query(Dataset)
        .filter(Dataset.id == payload.dataset_id)
        .first()
    )

    if dataset is None:
        raise ValueError("Dataset not found.")

    if not dataset.test_cases:
        raise ValueError("Dataset contains no test cases.")

    if agent_service.get_agent(payload.agent_name) is None:
        raise ValueError(f"Agent '{payload.agent_name}' not found.")

    now = datetime.utcnow()

    schedule = ScheduledBenchmark(
        name=payload.name,
        dataset_id=payload.dataset_id,
        agent_name=payload.agent_name,
        evaluator=payload.evaluator,
        interval_minutes=payload.interval_minutes,
        minimum_accuracy=payload.minimum_accuracy,
        max_regressions=payload.max_regressions,
        max_score_degradations=payload.max_score_degradations,
        require_baseline=payload.require_baseline,
        is_active=True,
        next_run_at=now + timedelta(
            minutes=payload.interval_minutes
        ),
        last_status="scheduled",
    )

    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    return schedule


def list_schedules(db: Session) -> list[ScheduledBenchmark]:
    return (
        db.query(ScheduledBenchmark)
        .order_by(ScheduledBenchmark.created_at.desc())
        .all()
    )


def get_schedule(
    db: Session,
    schedule_id: int,
) -> ScheduledBenchmark | None:
    return (
        db.query(ScheduledBenchmark)
        .filter(ScheduledBenchmark.id == schedule_id)
        .first()
    )


def update_schedule(
    db: Session,
    schedule_id: int,
    payload,
) -> ScheduledBenchmark | None:
    schedule = get_schedule(db, schedule_id)

    if schedule is None:
        return None

    changes = payload.model_dump(exclude_unset=True)
    interval_changed = "interval_minutes" in changes
    was_active = schedule.is_active

    for key, value in changes.items():
        setattr(schedule, key, value)

    if interval_changed or (not was_active and schedule.is_active):
        schedule.next_run_at = datetime.utcnow() + timedelta(
            minutes=schedule.interval_minutes
        )

    if not schedule.is_active:
        schedule.last_status = "paused"
    elif not was_active:
        schedule.last_status = "scheduled"

    db.commit()
    db.refresh(schedule)

    return schedule


def delete_schedule(db: Session, schedule_id: int) -> bool:
    schedule = get_schedule(db, schedule_id)

    if schedule is None:
        return False

    db.delete(schedule)
    db.commit()

    return True


def recover_abandoned_schedules(db: Session) -> int:
    """
    Make schedules eligible for retry when their worker crashed.

    The conditional update protects against recovering a schedule whose
    status or start time changed after the stale rows were selected.
    """
    now = datetime.utcnow()
    lease_expired_at = now - timedelta(
        minutes=SCHEDULE_LEASE_MINUTES
    )

    stale_schedules = (
        db.query(
            ScheduledBenchmark.id,
            ScheduledBenchmark.last_run_at,
        )
        .filter(
            ScheduledBenchmark.is_active.is_(True),
            ScheduledBenchmark.last_status == "running",
            ScheduledBenchmark.last_run_at <= lease_expired_at,
        )
        .all()
    )

    recovered = 0

    for schedule_id, started_at in stale_schedules:
        result = db.execute(
            update(ScheduledBenchmark)
            .where(
                ScheduledBenchmark.id == schedule_id,
                ScheduledBenchmark.is_active.is_(True),
                ScheduledBenchmark.last_status == "running",
                ScheduledBenchmark.last_run_at == started_at,
            )
            .values(
                last_status="scheduled",
                next_run_at=now,
                last_error=(
                    "Previous execution exceeded the "
                    f"{SCHEDULE_LEASE_MINUTES}-minute lease. "
                    "The schedule was recovered for retry."
                ),
            )
            .execution_options(synchronize_session=False)
        )

        if result.rowcount == 1:
            recovered += 1

    if recovered:
        db.commit()
    else:
        db.rollback()

    return recovered


def run_due_schedules(db: Session) -> int:
    """
    Atomically claim and execute due schedules.

    A conditional UPDATE ensures that competing workers cannot claim
    the same due occurrence. Abandoned executions are recovered after
    their lease expires.
    """
    from backend.app.services.evaluation_service import (
        run_agent_evaluation,
    )
    from backend.app.services.quality_gate_service import (
        evaluate_quality_gate,
    )

    now = datetime.utcnow()

    recover_abandoned_schedules(db)

    due_schedules = (
        db.query(
            ScheduledBenchmark.id,
            ScheduledBenchmark.next_run_at,
            ScheduledBenchmark.interval_minutes,
            ScheduledBenchmark.dataset_id,
            ScheduledBenchmark.agent_name,
            ScheduledBenchmark.evaluator,
            ScheduledBenchmark.minimum_accuracy,
            ScheduledBenchmark.max_regressions,
            ScheduledBenchmark.max_score_degradations,
            ScheduledBenchmark.require_baseline,
        )
        .filter(
            ScheduledBenchmark.is_active.is_(True),
            ScheduledBenchmark.next_run_at <= now,
            ScheduledBenchmark.last_status != "running",
        )
        .order_by(ScheduledBenchmark.next_run_at.asc())
        .all()
    )

    completed = 0

    for (
        schedule_id,
        due_at,
        interval_minutes,
        dataset_id,
        agent_name,
        evaluator_name,
        minimum_accuracy,
        max_regressions,
        max_score_degradations,
        require_baseline,
    ) in due_schedules:

        claim = (
            update(ScheduledBenchmark)
            .where(
                ScheduledBenchmark.id == schedule_id,
                ScheduledBenchmark.is_active.is_(True),
                ScheduledBenchmark.next_run_at == due_at,
                ScheduledBenchmark.last_status != "running",
            )
            .values(
                last_status="running",
                last_run_at=now,
                next_run_at=now + timedelta(
                    minutes=interval_minutes
                ),
                last_error=None,
            )
            .execution_options(synchronize_session=False)
        )

        result = db.execute(claim)

        if result.rowcount != 1:
            db.rollback()
            continue

        # Commit the claim before starting the evaluation.
        db.commit()

        try:
            evaluation = run_agent_evaluation(
                db=db,
                dataset_id=dataset_id,
                agent_name=agent_name,
                evaluator_name=evaluator_name,
            )

            report = evaluate_quality_gate(
                db=db,
                evaluation_id=evaluation.id,
                minimum_accuracy=minimum_accuracy,
                max_regressions=max_regressions,
                max_score_degradations=max_score_degradations,
                require_baseline=require_baseline,
            )

            current = get_schedule(db, schedule_id)

            if current is not None:
                current.last_evaluation_id = evaluation.id
                current.last_status = "completed"
                current.last_quality_decision = report["decision"]
                current.last_quality_report = json.dumps(report)
                current.last_error = None

                db.commit()

            completed += 1

        except Exception as error:
            db.rollback()

            current = get_schedule(db, schedule_id)

            if current is not None:
                current.last_status = "failed"
                current.last_error = str(error)[:2000]

                db.commit()

    return completed