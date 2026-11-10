import json
from pathlib import Path

from backend.app.database import SessionLocal
from backend.app.models import Dataset, TestCase

DATASET_NAME = "Support Agent Reliability Benchmark"
DATASET_DESCRIPTION = (
    "Curated deterministic benchmark covering accuracy, safety, "
    "tool-use honesty, and instruction following."
)
CASES_PATH = Path(__file__).with_name("benchmark_cases.json")


def seed_benchmark():
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    db = SessionLocal()
    try:
        dataset = db.query(Dataset).filter(Dataset.name == DATASET_NAME).first()
        if dataset is None:
            dataset = Dataset(name=DATASET_NAME, description=DATASET_DESCRIPTION)
            db.add(dataset)
            db.flush()

        created = linked = 0
        for item in cases:
            test_case = db.query(TestCase).filter(TestCase.name == item["name"]).first()
            if test_case is None:
                test_case = TestCase(**item)
                db.add(test_case)
                db.flush()
                created += 1
            if test_case not in dataset.test_cases:
                dataset.test_cases.append(test_case)
                linked += 1

        db.commit()
        print(f"Dataset: {dataset.name} (ID: {dataset.id})")
        print(f"Cases in benchmark: {len(cases)}")
        print(f"New cases created: {created}")
        print(f"New links created: {linked}")
        print(f"Cases assigned: {len(dataset.test_cases)}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_benchmark()
