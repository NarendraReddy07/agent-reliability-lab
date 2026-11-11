from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ScheduledBenchmarkCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    dataset_id: int = Field(gt=0)
    agent_name: str = Field(min_length=1, max_length=120)
    evaluator: Literal[
        "exact_match",
        "keyword_match",
        "similarity",
    ] = "similarity"
    interval_minutes: int = Field(default=60, ge=5, le=10080)
    minimum_accuracy: float = Field(default=95.0, ge=0, le=100)
    max_regressions: int = Field(default=0, ge=0, le=1000)
    max_score_degradations: int = Field(default=0, ge=0, le=1000)
    require_baseline: bool = False


class ScheduledBenchmarkUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=120)
    evaluator: Literal[
        "exact_match",
        "keyword_match",
        "similarity",
    ] | None = None
    interval_minutes: int | None = Field(
        default=None,
        ge=5,
        le=10080,
    )
    minimum_accuracy: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )
    max_regressions: int | None = Field(
        default=None,
        ge=0,
        le=1000,
    )
    max_score_degradations: int | None = Field(
        default=None,
        ge=0,
        le=1000,
    )
    require_baseline: bool | None = None
    is_active: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def reject_explicit_nulls(cls, values):
        if isinstance(values, dict):
            null_fields = [
                field for field, value in values.items()
                if value is None
            ]

            if null_fields:
                raise ValueError(
                    "Fields cannot be null: "
                    + ", ".join(sorted(null_fields))
                )

        return values


class ScheduledBenchmarkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    dataset_id: int
    agent_name: str
    evaluator: str
    interval_minutes: int
    minimum_accuracy: float
    max_regressions: int
    max_score_degradations: int
    require_baseline: bool
    is_active: bool
    next_run_at: datetime
    last_run_at: datetime | None
    last_evaluation_id: int | None
    last_status: str
    last_error: str | None
    last_quality_decision: str | None
    last_quality_report: str | None
    created_at: datetime
    updated_at: datetime