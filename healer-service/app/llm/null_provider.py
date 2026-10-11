from app.llm.base import LLMProvider


class NullProvider(LLMProvider):
    """No LLM: the service falls back to heuristics + memory only."""

    name = "none"

    @property
    def available(self) -> bool:
        return False

    def complete(self, system: str, user: str) -> str:
        raise RuntimeError("No LLM provider configured")
