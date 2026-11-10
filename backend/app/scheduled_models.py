from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from backend.app.database import Base


class ScheduledBenchmark(Base):
    __tablename__ = "scheduled_benchmarks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    agent_name = Column(String(120), nullable=False)
    evaluator = Column(String(40), nullable=False, default="similarity")
    interval_minutes = Column(Integer, nullable=False)

    minimum_accuracy = Column(Float, nullable=False, default=95.0)
    max_regressions = Column(Integer, nullable=False, default=0)
    max_score_degradations = Column(Integer, nullable=False, default=0)
    require_baseline = Column(Boolean, nullable=False, default=False)

    is_active = Column(Boolean, nullable=False, default=True)
    next_run_at = Column(DateTime, nullable=False)
    last_run_at = Column(DateTime, nullable=True)
    last_evaluation_id = Column(Integer, ForeignKey("evaluation_runs.id"), nullable=True)
    last_status = Column(String(30), nullable=False, default="scheduled")
    last_error = Column(Text, nullable=True)
    last_quality_decision = Column(String(10), nullable=True)
    last_quality_report = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
