import logging

from fastapi import FastAPI

from app.api import failures, feedback, heal, health
from app.core.config import Settings
from app.core.logging import setup_logging


def create_app() -> FastAPI:
    setup_logging(Settings.from_env().log_level)
    app = FastAPI(
        title="Self-Healing Locator Service",
        version="1.0.0",
        description="RAG-based locator healing and failure triage for Playwright tests.",
    )
    for module in (heal, feedback, failures, health):
        app.include_router(module.router)
    logging.getLogger(__name__).info("healer service ready")
    return app


app = create_app()
