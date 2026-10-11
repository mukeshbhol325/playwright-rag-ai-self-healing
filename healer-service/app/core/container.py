"""Tiny dependency container: builds the object graph once per process."""
from functools import lru_cache

from app.core.config import Settings
from app.llm.base import LLMProvider
from app.llm.factory import get_llm
from app.rag.vector_store import KnowledgeBase
from app.services.failure_analyzer import FailureAnalyzer
from app.services.heuristic_healer import HeuristicHealer
from app.services.rag_healer import RagHealer


class Container:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.llm: LLMProvider = get_llm(settings)
        self.kb = KnowledgeBase(settings)
        self.heuristic = HeuristicHealer()
        self.healer = RagHealer(self.kb, self.heuristic, self.llm, settings)
        self.analyzer = FailureAnalyzer(self.kb, self.llm)


@lru_cache
def get_container() -> Container:
    return Container(Settings.from_env())
