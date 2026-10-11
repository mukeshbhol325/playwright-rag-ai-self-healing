from fastapi import APIRouter, Depends

from app.core.container import Container, get_container
from app.models.schemas import FeedbackRequest, FeedbackResponse
from app.rag.vector_store import KIND_HEAL

router = APIRouter(tags=["healing"])


@router.post("/feedback", response_model=FeedbackResponse)
def feedback(req: FeedbackRequest, c: Container = Depends(get_container)) -> FeedbackResponse:
    """Record whether a proposed locator worked, so future heals can learn from it."""
    verdict = "worked" if req.success else "did not work"
    doc_id = c.kb.add(
        f"{req.failed_selector} -> {req.healed_selector} ({verdict}) on {req.page_url}. {req.reason}".strip(),
        {
            "kind": KIND_HEAL,
            "failed_selector": req.failed_selector,
            "healed_selector": req.healed_selector,
            "success": req.success,
            "page_url": req.page_url,
            "test_name": req.test_name,
        },
    )
    return FeedbackResponse(stored=doc_id is not None)
