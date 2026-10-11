"""Central settings, read once from environment variables (.env supported)."""
import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass

# Chroma telemetry is noise for a local tool.
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")


@dataclass(frozen=True)
class Settings:
    llm_provider: str = "none"  # gemini | none
    gemini_model: str = "gemini-2.5-flash"
    embeddings_provider: str = "hashing"  # gemini | hashing
    gemini_embedding_model: str = "gemini-embedding-001"
    kb_dir: str = "./data/chroma"
    log_level: str = "INFO"
    max_dom_chars: int = 200_000
    min_candidate_confidence: float = 0.35
    max_candidates: int = 3

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            llm_provider=os.getenv("LLM_PROVIDER", "none").lower(),
            gemini_model=os.getenv("GEMINI_MODEL", cls.gemini_model),
            gemini_embedding_model=os.getenv("GEMINI_EMBEDDING_MODEL", cls.gemini_embedding_model),
            embeddings_provider=os.getenv("EMBEDDINGS_PROVIDER", "hashing").lower(),
            kb_dir=os.getenv("KB_DIR", cls.kb_dir),
            log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
            max_dom_chars=int(os.getenv("MAX_DOM_CHARS", cls.max_dom_chars)),
        )
