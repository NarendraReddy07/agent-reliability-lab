from sqlalchemy.orm import Session, joinedload

from backend.app.models import EvaluationCaseResult, EvaluationRun


# Score movements smaller than this are treated as normal evaluator variation.
SCORE_CHANGE_THRESHOLD = 0.05


def compare_evaluation_runs(db: Session, evaluation_id: int) -> dict:
    """Compare a run with the latest earlier run for the same agent, dataset and evaluator."""
    current = (
        db.query(EvaluationRun)
        .options(
            joinedload(EvaluationRun.case_results).joinedload(
                EvaluationCaseResult.test_case
            )
        )
        .filter(EvaluationRun.id == evaluation_id)
        .first()
    )
    if current is None:
        raise ValueError("Evaluation run not found.")

    current_results = list(current.case_results)
    evaluator_names = {item.evaluator for item in current_results}
    if len(evaluator_names) != 1:
        raise ValueError(
            "Regression comparison requires one consistent evaluator per run."
        )
    evaluator_name = next(iter(evaluator_names))

    candidates = (
        db.query(EvaluationRun)
        .options(
            joinedload(EvaluationRun.case_results).joinedload(
                EvaluationCaseResult.test_case
            )
        )
        .filter(
            EvaluationRun.id < current.id,
            EvaluationRun.dataset_id == current.dataset_id,
            EvaluationRun.agent_name == current.agent_name,
        )
        .order_by(EvaluationRun.id.desc())
        .all()
    )

    baseline = None
    for candidate in candidates:
        candidate_evaluators = {item.evaluator for item in candidate.case_results}
        if candidate_evaluators == {evaluator_name}:
            baseline = candidate
            break

    if baseline is None:
        return {
            "evaluation_id": current.id,
            "baseline_evaluation_id": None,
            "comparison_available": False,
            "reason": "No earlier run exists for this agent, dataset and evaluator.",
            "accuracy_delta": None,
            "score_change_threshold": SCORE_CHANGE_THRESHOLD,
            "regressions": [],
            "improvements": [],
            "score_degradations": [],
            "score_improvements": [],
            "unchanged": [],
            "new_cases": [],
            "removed_cases": [],
            "summary": {
                "regressions": 0,
                "improvements": 0,
                "score_degradations": 0,
                "score_improvements": 0,
                "unchanged": 0,
                "new_cases": 0,
                "removed_cases": 0,
            },
        }

    previous_by_case = {item.test_case_id: item for item in baseline.case_results}
    current_by_case = {item.test_case_id: item for item in current_results}

    regressions = []
    improvements = []
    score_degradations = []
    score_improvements = []
    unchanged = []
    new_cases = []
    removed_cases = []

    for case_id, result in current_by_case.items():
        previous = previous_by_case.get(case_id)
        case_name = (
            result.test_case.name
            if result.test_case
            else f"Test case #{case_id}"
        )
        current_score = round(float(result.score or 0.0), 4)
        entry = {
            "test_case_id": case_id,
            "test_case_name": case_name,
            "previous_score": round(float(previous.score or 0.0), 4)
            if previous
            else None,
            "current_score": current_score,
            "score_delta": round(
                current_score - float(previous.score or 0.0), 4
            )
            if previous
            else None,
            "previous_passed": bool(previous.passed) if previous else None,
            "current_passed": bool(result.passed),
        }

        if previous is None:
            new_cases.append(entry)
            continue

        previous_score = float(previous.score or 0.0)
        score_delta = current_score - previous_score

        if previous.passed and not result.passed:
            regressions.append(entry)
        elif not previous.passed and result.passed:
            improvements.append(entry)

        if score_delta <= -SCORE_CHANGE_THRESHOLD:
            score_degradations.append(entry)
        elif score_delta >= SCORE_CHANGE_THRESHOLD:
            score_improvements.append(entry)
        elif previous.passed == result.passed:
            unchanged.append(entry)

    for case_id, result in previous_by_case.items():
        if case_id not in current_by_case:
            removed_cases.append({
                "test_case_id": case_id,
                "test_case_name": (
                    result.test_case.name
                    if result.test_case
                    else f"Test case #{case_id}"
                ),
                "previous_score": round(float(result.score or 0.0), 4),
                "previous_passed": bool(result.passed),
            })

    accuracy_delta = round(
        float(current.accuracy or 0.0) - float(baseline.accuracy or 0.0),
        2,
    )

    return {
        "evaluation_id": current.id,
        "baseline_evaluation_id": baseline.id,
        "comparison_available": True,
        "agent_name": current.agent_name,
        "dataset_id": current.dataset_id,
        "evaluator": evaluator_name,
        "current_accuracy": round(float(current.accuracy or 0.0), 2),
        "baseline_accuracy": round(float(baseline.accuracy or 0.0), 2),
        "accuracy_delta": accuracy_delta,
        "score_change_threshold": SCORE_CHANGE_THRESHOLD,
        "regressions": regressions,
        "improvements": improvements,
        "score_degradations": score_degradations,
        "score_improvements": score_improvements,
        "unchanged": unchanged,
        "new_cases": new_cases,
        "removed_cases": removed_cases,
        "summary": {
            "regressions": len(regressions),
            "improvements": len(improvements),
            "score_degradations": len(score_degradations),
            "score_improvements": len(score_improvements),
            "unchanged": len(unchanged),
            "new_cases": len(new_cases),
            "removed_cases": len(removed_cases),
        },
    }
