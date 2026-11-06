
from datetime import datetime

from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
    Table,
    Float,
    Boolean,
    DateTime,
)
from sqlalchemy.orm import relationship

from backend.app.database import Base


dataset_test_cases = Table(
    "dataset_test_cases",
    Base.metadata,
    Column("dataset_id", Integer, ForeignKey("datasets.id"), primary_key=True),
    Column("test_case_id", Integer, ForeignKey("test_cases.id"), primary_key=True),
)


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(String(500), nullable=False)
    category = Column(String(50), nullable=False)
    expected_prompt = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=False)


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(String(500), nullable=False)

    test_cases = relationship(
        "TestCase",
        secondary=dataset_test_cases,
        backref="datasets",
    )

    evaluation_runs = relationship(
        "EvaluationRun",
        back_populates="dataset",
    )


class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)

    total_cases = Column(Integer, nullable=False)
    passed_cases = Column(Integer, nullable=False)
    failed_cases = Column(Integer, nullable=False)
    accuracy = Column(Float, nullable=False)
    status = Column(String(30), nullable=False)

    dataset = relationship(
        "Dataset",
        back_populates="evaluation_runs",
    )

    case_results = relationship(
        "EvaluationCaseResult",
        back_populates="evaluation_run",
        cascade="all, delete-orphan",
    )


class EvaluationCaseResult(Base):
    __tablename__ = "evaluation_case_results"

    id = Column(Integer, primary_key=True, index=True)

    evaluation_run_id = Column(
        Integer,
        ForeignKey("evaluation_runs.id"),
        nullable=False,
    )

    test_case_id = Column(
        Integer,
        ForeignKey("test_cases.id"),
        nullable=False,
    )

    actual_output = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=False)
    score = Column(Float, nullable=False)
    passed = Column(Boolean, nullable=False)
    evaluator = Column(String(50), nullable=False)
    details = Column(Text, nullable=True)

    evaluation_run = relationship(
        "EvaluationRun",
        back_populates="case_results",
    )

    test_case = relationship("TestCase")


class AgentExecution(Base):
    __tablename__ = "agent_executions"

    id = Column(Integer, primary_key=True, index=True)
    agent_name = Column(String(120), nullable=False)
    prompt = Column(Text, nullable=False)
    output = Column(Text, nullable=True)

    provider = Column(String(80), nullable=True)
    model = Column(String(120), nullable=True)

    status = Column(String(30), nullable=False)
    error = Column(Text, nullable=True)

    duration_ms = Column(Float, nullable=False, default=0.0)
    trace = Column(Text, nullable=False)

    executed_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )