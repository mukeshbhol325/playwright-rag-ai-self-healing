from fastapi import APIRouter, Depends

from app.core.container import Container, get_container
from app.models.schemas import HealthResponse, StatsResponse
from app.rag.vector_store import KIND_FAILURE, KIND_HEAL

router = APIRouter(tags=["ops"])


@router.get("/health", response_model=HealthResponse)
def health(c: Container = Depends(get_container)) -> HealthResponse:
    return HealthResponse(
        llm_provider=c.llm.name,
        llm_available=c.llm.available,
        embeddings_provider=c.kb.embeddings_name,
    )


@router.get("/stats", response_model=StatsResponse)
def stats(c: Container = Depends(get_container)) -> StatsResponse:
    return StatsResponse(
        heal_records=c.kb.count(KIND_HEAL),
        successful_heals=c.kb.count(KIND_HEAL, success_only=True),
        failure_records=c.kb.count(KIND_FAILURE),
    )
