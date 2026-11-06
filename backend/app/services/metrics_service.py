
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.models import (
    EvaluationRun,
    EvaluationCaseResult,
    Dataset,
)


def get_evaluation_overview(db: Session):
    total_runs = db.query(EvaluationRun).count()

    total_cases = db.query(
        func.sum(EvaluationRun.total_cases)
    ).scalar() or 0

    passed_cases = db.query(
        func.sum(EvaluationRun.passed_cases)
    ).scalar() or 0

    failed_cases = db.query(
        func.sum(EvaluationRun.failed_cases)
    ).scalar() or 0

    average_accuracy = db.query(
        func.avg(EvaluationRun.accuracy)
    ).scalar()

    return {
        "total_evaluation_runs": total_runs,
        "total_cases_evaluated": total_cases,
        "total_passed_cases": passed_cases,
        "total_failed_cases": failed_cases,
        "average_accuracy": round(
            average_accuracy or 0.0,
            2,
        ),
    }


def get_evaluator_comparison(db: Session):
    rows = db.query(
        EvaluationCaseResult.evaluator,
        func.count(EvaluationCaseResult.id).label("total"),
        func.sum(
            func.cast(
                EvaluationCaseResult.passed,
                type_=__import__("sqlalchemy").Integer,
            )
        ).label("passed"),
        func.avg(EvaluationCaseResult.score).label("average_score"),
    ).group_by(
        EvaluationCaseResult.evaluator
    ).all()

    return [
        {
            "evaluator": row.evaluator,
            "total_cases": row.total,
            "passed_cases": row.passed or 0,
            "failed_cases": row.total - (row.passed or 0),
            "average_score": round(
                row.average_score or 0.0,
                4,
            ),
        }
        for row in rows
    ]


def get_dataset_performance(db: Session):
    rows = db.query(
        Dataset.id,
        Dataset.name,
        func.count(EvaluationRun.id).label("total_runs"),
        func.avg(EvaluationRun.accuracy).label("average_accuracy"),
    ).outerjoin(
        EvaluationRun,
        Dataset.id == EvaluationRun.dataset_id,
    ).group_by(
        Dataset.id,
        Dataset.name,
    ).all()

    return [
        {
            "dataset_id": row.id,
            "dataset_name": row.name,
            "total_evaluation_runs": row.total_runs,
            "average_accuracy": round(
                row.average_accuracy or 0.0,
                2,
            ),
        }
        for row in rows
    ]


def get_recent_evaluations(
    db: Session,
    limit: int = 10,
):
    evaluations = db.query(EvaluationRun).order_by(
        EvaluationRun.id.desc()
    ).limit(limit).all()

    return [
        {
            "id": item.id,
            "dataset_id": item.dataset_id,
            "total_cases": item.total_cases,
            "passed_cases": item.passed_cases,
            "failed_cases": item.failed_cases,
            "accuracy": item.accuracy,
            "status": item.status,
        }
        for item in evaluations
    ]