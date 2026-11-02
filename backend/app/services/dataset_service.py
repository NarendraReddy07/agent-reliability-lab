from sqlalchemy.orm import Session

from backend.app.models import Dataset, TestCase
from backend.app.schemas import DatasetCreate


def create_dataset(db: Session, dataset: DatasetCreate) -> Dataset:
    db_dataset = Dataset(
        name=dataset.name,
        description=dataset.description,
    )

    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)

    return db_dataset


def get_all_datasets(db: Session) -> list[Dataset]:
    return db.query(Dataset).all()


def get_dataset(db: Session, dataset_id: int) -> Dataset | None:
    return db.query(Dataset).filter(Dataset.id == dataset_id).first()


def add_test_case_to_dataset(
    db: Session,
    dataset_id: int,
    test_case_id: int,
) -> Dataset | None:
    dataset = get_dataset(db, dataset_id)

    if dataset is None:
        return None

    test_case = db.query(TestCase).filter(
        TestCase.id == test_case_id
    ).first()

    if test_case is None:
        return None

    if test_case not in dataset.test_cases:
        dataset.test_cases.append(test_case)

    db.commit()
    db.refresh(dataset)

    return dataset