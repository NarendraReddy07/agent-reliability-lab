from sqlalchemy.orm import Session

from backend.app.models import (
    Dataset,
    EvaluationRun,
    EvaluationCaseResult,
)
from backend.app.schemas import EvaluationRequest


def normalize_text(value: str) -> str:
    return " ".join(value.strip().lower().split())


def evaluate_exact_match(
    expected: str,
    actual: str,
) -> tuple[float, bool, str]:
    passed = normalize_text(expected) == normalize_text(actual)

    return (
        1.0 if passed else 0.0,
        passed,
        "Outputs match exactly after normalization."
        if passed
        else "Outputs do not match.",
    )


def evaluate_keyword_match(
    expected: str,
    actual: str,
) -> tuple[float, bool, str]:
    import re

    keywords = {
        word.lower()
        for word in re.findall(r"\b\w+\b", expected)
        if len(word) > 2
    }

    actual_words = {
        word.lower()
        for word in re.findall(r"\b\w+\b", actual)
    }

    if not keywords:
        return 0.0, False, "No evaluable keywords found."

    matched = keywords.intersection(actual_words)
    score = len(matched) / len(keywords)
    passed = score >= 0.8

    return (
        round(score, 4),
        passed,
        f"Matched {len(matched)} of {len(keywords)} expected keywords.",
    )


def evaluate_similarity(
    expected: str,
    actual: str,
) -> tuple[float, bool, str]:
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


EVALUATORS = {
    "exact_match": evaluate_exact_match,
    "keyword_match": evaluate_keyword_match,
    "similarity": evaluate_similarity,
}


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

    evaluator = EVALUATORS[request.evaluator]
    results = []

    for test_case_id, test_case in dataset_cases.items():
        actual_output = submitted_outputs[test_case_id]

        score, passed, details = evaluator(
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
                evaluator=request.evaluator,
                details=details,
            )
        )

    total_cases = len(results)
    passed_cases = sum(result.passed for result in results)
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


def run_agent_evaluation(
    db: Session,
    dataset_id: int,
    agent_name: str,
    evaluator_name: str = "similarity",
) -> EvaluationRun:
    from backend.app.services.agent_service import agent_service

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id
    ).first()

    if dataset is None:
        raise ValueError("Dataset not found.")

    if not dataset.test_cases:
        raise ValueError("Dataset contains no test cases.")

    agent = agent_service.get_agent(agent_name)

    if agent is None:
        raise ValueError(f"Agent '{agent_name}' not found.")

    evaluator = EVALUATORS.get(evaluator_name)

    if evaluator is None:
        raise ValueError("Invalid evaluation strategy.")

    results = []

    for test_case in dataset.test_cases:
        execution = agent_service.execute_agent(
            db=db,
            agent_name=agent_name,
            prompt=test_case.expected_prompt,
        )

        actual_output = execution["output"]

        score, passed, details = evaluator(
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
                evaluator=evaluator_name,
                details=details,
            )
        )

    total_cases = len(results)
    passed_cases = sum(result.passed for result in results)
    failed_cases = total_cases - passed_cases
    accuracy = round(
        (passed_cases / total_cases) * 100,
        2,
    )

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