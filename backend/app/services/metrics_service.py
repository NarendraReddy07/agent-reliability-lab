from sqlalchemy import func, Integer
from sqlalchemy.orm import Session

from backend.app.models import (
    AgentExecution,
    Dataset,
    EvaluationCaseResult,
    EvaluationRun,
    TestCase,
)


def get_evaluation_overview(db: Session):
    total_runs = db.query(EvaluationRun).count()
    total_cases = db.query(func.sum(EvaluationRun.total_cases)).scalar() or 0
    passed_cases = db.query(func.sum(EvaluationRun.passed_cases)).scalar() or 0
    failed_cases = db.query(func.sum(EvaluationRun.failed_cases)).scalar() or 0
    average_accuracy = db.query(func.avg(EvaluationRun.accuracy)).scalar()

    return {
        "total_evaluation_runs": total_runs,
        "total_cases_evaluated": int(total_cases),
        "total_passed_cases": int(passed_cases),
        "total_failed_cases": int(failed_cases),
        "average_accuracy": round(average_accuracy or 0.0, 2),
        "weighted_accuracy": round((passed_cases / total_cases) * 100, 2) if total_cases else 0.0,
    }


def get_evaluator_comparison(db: Session):
    rows = db.query(
        EvaluationCaseResult.evaluator,
        func.count(EvaluationCaseResult.id).label("total"),
        func.sum(func.cast(EvaluationCaseResult.passed, Integer)).label("passed"),
        func.avg(EvaluationCaseResult.score).label("average_score"),
    ).group_by(EvaluationCaseResult.evaluator).all()

    return [
        {
            "evaluator": row.evaluator,
            "total_cases": row.total,
            "passed_cases": row.passed or 0,
            "failed_cases": row.total - (row.passed or 0),
            "average_score": round(row.average_score or 0.0, 4),
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
        EvaluationRun, Dataset.id == EvaluationRun.dataset_id
    ).group_by(Dataset.id, Dataset.name).all()

    return [
        {
            "dataset_id": row.id,
            "dataset_name": row.name,
            "total_evaluation_runs": row.total_runs,
            "average_accuracy": round(row.average_accuracy or 0.0, 2),
        }
        for row in rows
    ]


def get_recent_evaluations(db: Session, limit: int = 10):
    evaluations = db.query(EvaluationRun).order_by(
        EvaluationRun.id.desc()
    ).limit(limit).all()

    return [
        {
            "id": item.id,
            "dataset_id": item.dataset_id,
            "agent_name": getattr(item, "agent_name", None),
            "total_cases": item.total_cases,
            "passed_cases": item.passed_cases,
            "failed_cases": item.failed_cases,
            "accuracy": item.accuracy,
            "status": item.status,
        }
        for item in evaluations
    ]


def get_reliability_analytics(db: Session, limit: int = 30):
    """Return benchmark reliability views derived from persisted evaluation data."""
    runs = db.query(EvaluationRun).order_by(
        EvaluationRun.id.desc()
    ).limit(limit).all()

    accuracy_trend = [
        {
            "evaluation_id": run.id,
            "agent_name": getattr(run, "agent_name", None) or "Manual evaluation",
            "dataset_id": run.dataset_id,
            "accuracy": round(float(run.accuracy or 0.0), 2),
            "total_cases": run.total_cases,
            "passed_cases": run.passed_cases,
            "failed_cases": run.failed_cases,
        }
        for run in reversed(runs)
    ]

    category_rows = db.query(
        TestCase.category.label("category"),
        func.count(EvaluationCaseResult.id).label("total"),
        func.sum(func.cast(EvaluationCaseResult.passed, Integer)).label("passed"),
        func.avg(EvaluationCaseResult.score).label("average_score"),
    ).join(
        EvaluationCaseResult,
        EvaluationCaseResult.test_case_id == TestCase.id,
    ).group_by(TestCase.category).order_by(TestCase.category).all()

    category_performance = [
        {
            "category": row.category,
            "total_cases": row.total,
            "passed_cases": row.passed or 0,
            "failed_cases": row.total - (row.passed or 0),
            "pass_rate": round(((row.passed or 0) / row.total) * 100, 2) if row.total else 0.0,
            "average_score": round(row.average_score or 0.0, 4),
        }
        for row in category_rows
    ]

    latency_rows = db.query(
        EvaluationRun.id.label("evaluation_id"),
        EvaluationRun.agent_name.label("agent_name"),
        EvaluationRun.accuracy.label("accuracy"),
        EvaluationRun.total_cases.label("total_cases"),
        func.avg(AgentExecution.duration_ms).label("average_latency_ms"),
        func.count(AgentExecution.id).label("linked_executions"),
    ).join(
        EvaluationCaseResult,
        EvaluationCaseResult.evaluation_run_id == EvaluationRun.id,
    ).join(
        AgentExecution,
        AgentExecution.id == EvaluationCaseResult.execution_id,
    ).group_by(
        EvaluationRun.id,
        EvaluationRun.agent_name,
        EvaluationRun.accuracy,
        EvaluationRun.total_cases,
    ).order_by(EvaluationRun.id).all()

    latency_accuracy = [
        {
            "evaluation_id": row.evaluation_id,
            "agent_name": row.agent_name or "Unknown agent",
            "accuracy": round(float(row.accuracy or 0.0), 2),
            "average_latency_ms": round(float(row.average_latency_ms or 0.0), 4),
            "total_cases": row.total_cases,
            "linked_executions": row.linked_executions,
        }
        for row in latency_rows
    ]

    agent_rows = db.query(
        EvaluationRun.agent_name.label("agent_name"),
        func.count(EvaluationRun.id).label("runs"),
        func.sum(EvaluationRun.total_cases).label("cases"),
        func.sum(EvaluationRun.passed_cases).label("passed"),
        func.sum(EvaluationRun.failed_cases).label("failed"),
        func.avg(EvaluationRun.accuracy).label("average_run_accuracy"),
    ).filter(
        EvaluationRun.agent_name.isnot(None)
    ).group_by(EvaluationRun.agent_name).order_by(EvaluationRun.agent_name).all()

    agent_reliability = [
        {
            "agent_name": row.agent_name,
            "evaluation_runs": row.runs,
            "total_cases": int(row.cases or 0),
            "passed_cases": int(row.passed or 0),
            "failed_cases": int(row.failed or 0),
            "average_run_accuracy": round(row.average_run_accuracy or 0.0, 2),
            "weighted_accuracy": round(((row.passed or 0) / row.cases) * 100, 2) if row.cases else 0.0,
        }
        for row in agent_rows
    ]

    return {
        "accuracy_trend": accuracy_trend,
        "category_performance": category_performance,
        "latency_accuracy": latency_accuracy,
        "agent_reliability": agent_reliability,
    }
