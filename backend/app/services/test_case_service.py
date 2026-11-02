from sqlalchemy.orm import Session

from backend.app.models import TestCase
from backend.app.schemas import TestCaseCreate


def create_test_case(db: Session, test_case: TestCaseCreate) -> TestCase:
    db_test_case = TestCase(
        name=test_case.name,
        description=test_case.description,
        category=test_case.category,
        expected_prompt=test_case.expected_prompt,
        expected_output=test_case.expected_output,
    )

    db.add(db_test_case)
    db.commit()
    db.refresh(db_test_case)

    return db_test_case


def get_all_test_cases(db: Session) -> list[TestCase]:
    return db.query(TestCase).all()


def get_test_case(db: Session, test_case_id: int) -> TestCase | None:
    return db.query(TestCase).filter(
        TestCase.id == test_case_id
    ).first()


def delete_test_case(db: Session, test_case_id: int) -> bool:
    test_case = get_test_case(db, test_case_id)

    if test_case is None:
        return False

    db.delete(test_case)
    db.commit()

    return True