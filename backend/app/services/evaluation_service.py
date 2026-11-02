from sqlalchemy.orm import Session

from backend.app.models import (
    Dataset,
    EvaluationRun,
    EvaluationCaseResult,
)
from backend.app.schemas import EvaluationRequest


def normalize_text(value: str) -> str:
    """Normalize text for case-insensitive exact comparison."""
    return " ".join(value.strip().lower().split())


def evaluate_exact_match(expected: str, actual: str) -> tuple[float, bool, str]:
    expected_normalized = normalize_text(expected)
    actual_normalized = normalize_text(actual)

    passed = expected_normalized == actual_normalized

    return (
        1.0 if passed else 0.0,
        passed,
        "Outputs match exactly after normalization."
        if passed
        else "Outputs do not match.",
    )


def evaluate_keyword_match(expected: str, actual: str) -> tuple[float, bool, str]:
    keywords = {
        word.strip(".,!?;:()[]{}\"'").lower()
        for word in expected.split()
        if len(word.strip(".,!?;:()[]{}\"'")) > 2
    }

    actual_words = {
        word.strip(".,!?;:()[]{}\"'").lower()
        for word in actual.split()
    }

    if not keywords:
        return 0.0, False, "No evaluable keywords found in expected output."

    matched = keywords.intersection(actual_words)
    score = len(matched) / len(keywords)
    passed = score >= 0.8

    details = (
        f"Matched {len(matched)} of {len(keywords)} expected keywords."
    )

    return round(score, 4), passed, details


def evaluate_similarity(expected: str, actual: str) -> tuple[float, bool, str]:
    from difflib import SequenceMatcher

    score = SequenceMatcher(
        None,
        normalize_text(expected),
        normalize_text(actual),
    ).ratio()

    passed = score >= 0.8

    return (
        round(score, 4),
        passed,
        f"Text similarity score: {score:.4f}. Passing threshold: 0.8.",
    )


def run_evaluation(
    db: Session,
    request: EvaluationRequest,
) -> EvaluationRun:
    dataset = db.query(Dataset).filter(
        Dataset.id == request.dataset_id
    ).first()

    if dataset is None:
        raise ValueError("Dataset not found.")

    dataset_cases = {
        test_case.id: test_case
        for test_case in dataset.test_cases
    }

    if not dataset_cases:
        raise ValueError("Dataset contains no test cases.")

    submitted_outputs = {
        output.test_case_id: output.actual_output
        for output in request.outputs
    }

    if len(submitted_outputs) != len(request.outputs):
        raise ValueError("Duplicate test_case_id values were submitted.")

    if set(submitted_outputs) != set(dataset_cases):
        raise ValueError(
            "Submit exactly one output for every test case in the dataset."
        )

    results = []

    for test_case_id, test_case in dataset_cases.items():
        actual_output = submitted_outputs[test_case_id]

        score, passed, details = evaluate_similarity(
            test_case.expected_output,
            actual_output,
        )

        results.append(
            EvaluationCaseResult(
                test_case_id=test_case.id,
                actual_output=actual_output,
                expected_output=test_case.expected_output,
                score=score,
                passed=passed,
                evaluator="similarity",
                details=details,
            )
        )

    total_cases = len(results)
    passed_cases = sum(1 for result in results if result.passed)
    failed_cases = total_cases - passed_cases
    accuracy = round((passed_cases / total_cases) * 100, 2)

    evaluation_run = EvaluationRun(
        dataset_id=dataset.id,
        total_cases=total_cases,
        passed_cases=passed_cases,
        failed_cases=failed_cases,
        accuracy=accuracy,
        status="completed",
        case_results=results,
    )

    db.add(evaluation_run)
    db.commit()
    db.refresh(evaluation_run)

    return evaluation_run


def get_evaluation_run(
    db: Session,
    evaluation_id: int,
) -> EvaluationRun | None:
    return db.query(EvaluationRun).filter(
        EvaluationRun.id == evaluation_id
    ).first()


def get_all_evaluation_runs(db: Session) -> list[EvaluationRun]:
    return db.query(EvaluationRun).order_by(
        EvaluationRun.id.desc()
    ).all()