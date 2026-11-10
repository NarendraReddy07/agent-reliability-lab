import json
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from backend.app.models import Dataset
from backend.app.scheduled_models import ScheduledBenchmark
from backend.app.services.agent_service import agent_service


def create_schedule(db: Session, payload) -> ScheduledBenchmark:
    dataset = db.query(Dataset).filter(Dataset.id == payload.dataset_id).first()
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
        next_run_at=now + timedelta(minutes=payload.interval_minutes),
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


def get_schedule(db: Session, schedule_id: int) -> ScheduledBenchmark | None:
    return (
        db.query(ScheduledBenchmark)
        .filter(ScheduledBenchmark.id == schedule_id)
        .first()
    )


def update_schedule(db: Session, schedule_id: int, payload) -> ScheduledBenchmark | None:
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


def run_due_schedules(db: Session) -> int:
    """Execute due schedules sequentially; intended for one API worker process."""
    from backend.app.services.evaluation_service import run_agent_evaluation
    from backend.app.services.quality_gate_service import evaluate_quality_gate

    now = datetime.utcnow()
    due_schedules = (
        db.query(ScheduledBenchmark)
        .filter(
            ScheduledBenchmark.is_active.is_(True),
            ScheduledBenchmark.next_run_at <= now,
        )
        .order_by(ScheduledBenchmark.next_run_at.asc())
        .all()
    )

    completed = 0
    for schedule in due_schedules:
        schedule_id = schedule.id
        schedule.last_status = "running"
        schedule.last_run_at = now
        schedule.next_run_at = now + timedelta(minutes=schedule.interval_minutes)
        schedule.last_error = None
        db.commit()

        try:
            evaluation = run_agent_evaluation(
                db=db,
                dataset_id=schedule.dataset_id,
                agent_name=schedule.agent_name,
                evaluator_name=schedule.evaluator,
            )
            report = evaluate_quality_gate(
                db=db,
                evaluation_id=evaluation.id,
                minimum_accuracy=schedule.minimum_accuracy,
                max_regressions=schedule.max_regressions,
                max_score_degradations=schedule.max_score_degradations,
                require_baseline=schedule.require_baseline,
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
