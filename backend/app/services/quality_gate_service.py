from sqlalchemy.orm import Session

from backend.app.services.regression_service import compare_evaluation_runs
from backend.app.services.evaluation_service import get_evaluation_run


def evaluate_quality_gate(
    db: Session,
    evaluation_id: int,
    minimum_accuracy: float = 95.0,
    max_regressions: int = 0,
    max_score_degradations: int = 0,
    require_baseline: bool = True,
) -> dict:
    """Evaluate whether an agent run satisfies configured release-quality limits."""
    evaluation = get_evaluation_run(db, evaluation_id)
    if evaluation is None:
        raise ValueError("Evaluation run not found.")

    if evaluation.agent_name is None:
        raise ValueError("Quality gates require an agent-driven evaluation.")

    comparison = compare_evaluation_runs(db, evaluation_id)
    accuracy = float(evaluation.accuracy or 0.0)
    baseline_available = bool(comparison.get("comparison_available"))

    checks = {
        "minimum_accuracy": {
            "passed": accuracy >= minimum_accuracy,
            "actual": round(accuracy, 2),
            "required": minimum_accuracy,
            "message": (
                f"Accuracy {accuracy:.2f}% meets the minimum of "
                f"{minimum_accuracy:.2f}%."
                if accuracy >= minimum_accuracy
                else f"Accuracy {accuracy:.2f}% is below the minimum of "
                f"{minimum_accuracy:.2f}%."
            ),
        },
        "baseline_available": {
            "passed": baseline_available or not require_baseline,
            "actual": baseline_available,
            "required": require_baseline,
            "message": (
                "A comparable baseline run is available."
                if baseline_available
                else (
                    "A comparable baseline run is required but was not found."
                    if require_baseline
                    else "No baseline exists; baseline comparison is optional."
                )
            ),
        },
        "maximum_regressions": {
            "passed": (
                comparison.get("summary", {}).get("regressions", 0)
                <= max_regressions
            ) if baseline_available else not require_baseline,
            "actual": (
                comparison.get("summary", {}).get("regressions")
                if baseline_available else None
            ),
            "required": max_regressions,
            "message": (
                f"{comparison.get('summary', {}).get('regressions', 0)} regressions "
                f"found; maximum allowed is {max_regressions}."
                if baseline_available
                else "Cannot verify regression count without a baseline."
            ),
        },
        "maximum_score_degradations": {
            "passed": (
                comparison.get("summary", {}).get("score_degradations", 0)
                <= max_score_degradations
            ) if baseline_available else not require_baseline,
            "actual": (
                comparison.get("summary", {}).get("score_degradations")
                if baseline_available else None
            ),
            "required": max_score_degradations,
            "message": (
                f"{comparison.get('summary', {}).get('score_degradations', 0)} "
                f"score degradations found; maximum allowed is "
                f"{max_score_degradations}."
                if baseline_available
                else "Cannot verify score degradation without a baseline."
            ),
        },
    }

    failed_checks = [
        name for name, result in checks.items() if not result["passed"]
    ]

    return {
        "evaluation_id": evaluation.id,
        "agent_name": evaluation.agent_name,
        "dataset_id": evaluation.dataset_id,
        "decision": "pass" if not failed_checks else "fail",
        "passed": not failed_checks,
        "baseline_evaluation_id": comparison.get("baseline_evaluation_id"),
        "baseline_available": baseline_available,
        "configuration": {
            "minimum_accuracy": minimum_accuracy,
            "max_regressions": max_regressions,
            "max_score_degradations": max_score_degradations,
            "require_baseline": require_baseline,
        },
        "checks": checks,
        "failed_checks": failed_checks,
    }
