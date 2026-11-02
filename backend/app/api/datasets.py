from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas import DatasetCreate
from backend.app.services import dataset_service


router = APIRouter(
    prefix="/api/datasets",
    tags=["Datasets"],
)


def serialize_dataset(dataset):
    return {
        "id": dataset.id,
        "name": dataset.name,
        "description": dataset.description,
        "test_case_ids": [
            test_case.id for test_case in dataset.test_cases
        ],
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_dataset(
    dataset: DatasetCreate,
    db: Session = Depends(get_db),
):
    result = dataset_service.create_dataset(db, dataset)
    return serialize_dataset(result)


@router.get("/")
async def list_datasets(db: Session = Depends(get_db)):
    datasets = dataset_service.get_all_datasets(db)
    return [serialize_dataset(dataset) for dataset in datasets]


@router.get("/{dataset_id}")
async def retrieve_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
):
    result = dataset_service.get_dataset(db, dataset_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )

    return serialize_dataset(result)


@router.post("/{dataset_id}/test-cases/{test_case_id}")
async def add_test_case(
    dataset_id: int,
    test_case_id: int,
    db: Session = Depends(get_db),
):
    result = dataset_service.add_test_case_to_dataset(
        db,
        dataset_id,
        test_case_id,
    )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset or test case not found",
        )

    return serialize_dataset(result)