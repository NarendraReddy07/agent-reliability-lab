from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas import TestCaseCreate, TestCaseResponse
from backend.app.services import test_case_service


router = APIRouter(
    prefix="/api/test-cases",
    tags=["Test Cases"],
)


@router.post(
    "/",
    response_model=TestCaseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_test_case(
    test_case: TestCaseCreate,
    db: Session = Depends(get_db),
):
    return test_case_service.create_test_case(db, test_case)


@router.get("/", response_model=list[TestCaseResponse])
async def list_test_cases(db: Session = Depends(get_db)):
    return test_case_service.get_all_test_cases(db)


@router.get("/{test_case_id}", response_model=TestCaseResponse)
async def retrieve_test_case(
    test_case_id: int,
    db: Session = Depends(get_db),
):
    result = test_case_service.get_test_case(db, test_case_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test case not found",
        )

    return result


@router.delete("/{test_case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_test_case(
    test_case_id: int,
    db: Session = Depends(get_db),
):
    deleted = test_case_service.delete_test_case(db, test_case_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test case not found",
        )

    return None