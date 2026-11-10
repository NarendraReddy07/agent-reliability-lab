from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


class TestCaseCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=5, max_length=500)
    category: Literal[
        "accuracy",
        "tool_usage",
        "safety",
        "instruction_following",
    ]
    expected_prompt: str = Field(min_length=1, max_length=5000)
    expected_output: str = Field(min_length=1, max_length=5000)


class TestCaseResponse(TestCaseCreate):
    id: int


class DatasetCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=5, max_length=500)


class DatasetResponse(DatasetCreate):
    id: int
    test_case_ids: list[int] = []


class EvaluationCaseInput(BaseModel):
    test_case_id: int
    actual_output: str = Field(min_length=1, max_length=10000)


class EvaluationRequest(BaseModel):
    dataset_id: int
    outputs: list[EvaluationCaseInput] = Field(min_length=1)
    evaluator: Literal[
        "exact_match",
        "keyword_match",
        "similarity",
    ] = "similarity"


class AgentEvaluationRequest(BaseModel):
    dataset_id: int
    agent_name: str = Field(min_length=1, max_length=120)
    evaluator: Literal[
        "exact_match",
        "keyword_match",
        "similarity",
    ] = "similarity"


class EvaluationResultResponse(BaseModel):
    id: int
    dataset_id: int
    agent_name: str | None = None
    total_cases: int
    passed_cases: int
    failed_cases: int
    accuracy: float
    status: str


class EvaluationCaseResultResponse(BaseModel):
    id: int
    test_case_id: int
    test_case_name: str
    execution_id: int | None = None
    actual_output: str
    expected_output: str
    score: float
    passed: bool
    evaluator: str
    details: str | None


class EvaluationDetailResponse(EvaluationResultResponse):
    case_results: list[EvaluationCaseResultResponse] = Field(default_factory=list)


class ScheduledBenchmarkCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    dataset_id: int = Field(gt=0)
    agent_name: str = Field(min_length=1, max_length=120)
    evaluator: Literal["exact_match", "keyword_match", "similarity"] = "similarity"
    interval_minutes: int = Field(default=60, ge=5, le=10080)
    minimum_accuracy: float = Field(default=95.0, ge=0, le=100)
    max_regressions: int = Field(default=0, ge=0, le=1000)
    max_score_degradations: int = Field(default=0, ge=0, le=1000)
    require_baseline: bool = False


class ScheduledBenchmarkUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=120)
    evaluator: Literal["exact_match", "keyword_match", "similarity"] | None = None
    interval_minutes: int | None = Field(default=None, ge=5, le=10080)
    minimum_accuracy: float | None = Field(default=None, ge=0, le=100)
    max_regressions: int | None = Field(default=None, ge=0, le=1000)
    max_score_degradations: int | None = Field(default=None, ge=0, le=1000)
    require_baseline: bool | None = None
    is_active: bool | None = None


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
