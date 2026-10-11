from fastapi import APIRouter, Depends

from app.core.container import Container, get_container
from app.models.schemas import FailureAnalysis, FailureReport

router = APIRouter(tags=["analysis"])


@router.post("/failures", response_model=FailureAnalysis)
def failures(report: FailureReport, c: Container = Depends(get_container)) -> FailureAnalysis:
    """Called by the Playwright reporter after a test fails: classify it and suggest a fix."""
    return c.analyzer.analyze(report)
