from typing import Literal

from pydantic import BaseModel, Field


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
