"""Pydantic contracts shared with the Playwright (TypeScript) client."""
from typing import Optional

from pydantic import BaseModel, Field


class HealRequest(BaseModel):
    test_name: str = ""
    action: str = Field("click", description="click | fill | select | check | wait")
    failed_selector: str
    error: str = ""
    page_url: str = ""
    dom: str = Field(..., description="Scrubbed HTML snapshot taken at failure time")


class Candidate(BaseModel):
    selector: str
    confidence: float
    reason: str
    source: str = "heuristic"  # memory | heuristic | llm


class HealResponse(BaseModel):
    candidates: list[Candidate]
    strategy: str
    retrieved_cases: int = 0


class FeedbackRequest(BaseModel):
    test_name: str = ""
    failed_selector: str
    healed_selector: str
    success: bool
    page_url: str = ""
    reason: str = ""


class FeedbackResponse(BaseModel):
    stored: bool = True


class FailureReport(BaseModel):
    test_name: str
    file: str = ""
    status: str = "failed"
    error: str = ""
    duration_ms: int = 0
    retry: int = 0
    failed_selector: Optional[str] = None
    page_url: str = ""


class SimilarCase(BaseModel):
    summary: str
    score: float


class FailureAnalysis(BaseModel):
    category: str
    summary: str
    suggested_fix: str
    similar_cases: list[SimilarCase] = []
    used_llm: bool = False


class HealthResponse(BaseModel):
    status: str = "ok"
    llm_provider: str
    llm_available: bool
    embeddings_provider: str


class StatsResponse(BaseModel):
    heal_records: int
    successful_heals: int
    failure_records: int
