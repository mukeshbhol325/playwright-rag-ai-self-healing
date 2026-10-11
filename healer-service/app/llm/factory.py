import logging

from app.core.config import Settings
from app.llm.base import LLMProvider
from app.llm.null_provider import NullProvider

log = logging.getLogger(__name__)


def get_llm(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "gemini":
        try:
            from app.llm.gemini_provider import GeminiProvider

            provider = GeminiProvider(settings.gemini_model)
            if not provider.available:
                log.warning("LLM_PROVIDER=gemini but GEMINI_API_KEY is not set; using heuristics only")
                return NullProvider()
            return provider
        except Exception as exc:
            log.warning("Gemini LLM unavailable (%s); using heuristics only", exc)
    return NullProvider()