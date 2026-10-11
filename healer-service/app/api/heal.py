from fastapi import APIRouter, Depends

from app.core.container import Container, get_container
from app.models.schemas import HealRequest, HealResponse

router = APIRouter(tags=["healing"])


@router.post("/heal", response_model=HealResponse)
def heal(req: HealRequest, c: Container = Depends(get_container)) -> HealResponse:
    """Propose replacement locators for a selector that no longer works."""
    return c.healer.heal(req)
