from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas import (
    EvaluationRequest,
    EvaluationResultResponse,
)
from backend.app.services import evaluation_service


router = APIRouter(
    prefix="/api/evaluations",
    tags=["Evaluations"],
)


def serialize_evaluation(evaluation):
    return {
        "id": evaluation.id,
        "dataset_id": evaluation.dataset_id,
        "total_cases": evaluation.total_cases,
        "passed_cases": evaluation.passed_cases,
        "failed_cases": evaluation.failed_cases,
        "accuracy": evaluation.accuracy,
        "status": evaluation.status,
    }


@router.post(
    "/",
    response_model=EvaluationResultResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_evaluation(
    request: EvaluationRequest,
    db: Session = Depends(get_db),
):
    try:
        result = evaluation_service.run_evaluation(db, request)
        return serialize_evaluation(result)

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get("/", response_model=list[EvaluationResultResponse])
async def list_evaluations(db: Session = Depends(get_db)):
    evaluations = evaluation_service.get_all_evaluation_runs(db)

    return [
        serialize_evaluation(evaluation)
        for evaluation in evaluations
    ]


@router.get(
    "/{evaluation_id}",
    response_model=EvaluationResultResponse,
)
async def retrieve_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_db),
):
    result = evaluation_service.get_evaluation_run(
        db,
        evaluation_id,
    )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation run not found",
        )

    return serialize_evaluation(result)