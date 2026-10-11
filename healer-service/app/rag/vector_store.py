"""Knowledge base of past heals and failures, stored in Chroma via LangChain."""
import logging
import uuid

from langchain_chroma import Chroma
from langchain_core.documents import Document

from app.core.config import Settings
from app.rag.embeddings import build_embeddings

log = logging.getLogger(__name__)

KIND_HEAL = "heal"
KIND_FAILURE = "failure"


class KnowledgeBase:
    def __init__(self, settings: Settings):
        embeddings, self.embeddings_name = build_embeddings(settings)
        self.store = Chroma(
            collection_name=f"selfheal_cases_{self.embeddings_name}",
            embedding_function=embeddings,
            persist_directory=settings.kb_dir,
        )

    def add(self, text: str, metadata: dict) -> str | None:
        clean = {k: v if isinstance(v, (str, int, float, bool)) else str(v) for k, v in metadata.items()}
        doc_id = str(uuid.uuid4())
        try:
            self.store.add_documents([Document(page_content=text, metadata=clean)], ids=[doc_id])
        except Exception as exc:
            log.warning("Could not store knowledge-base record: %s", exc)
            return None
        return doc_id

    def search(self, query: str, k: int = 4, kind: str | None = None) -> list[tuple[Document, float]]:
        """Semantic top-k. Returns (document, distance); lower distance = more similar."""
        try:
            return self.store.similarity_search_with_score(query, k=k, filter={"kind": kind} if kind else None)
        except Exception as exc:  # empty collection, k > size, etc.
            log.debug("KB search returned nothing: %s", exc)
            return []

    def learned_fix(self, failed_selector: str, page_url: str = "") -> str | None:
        """Exact-match lookup: the most recent successful heal for this selector."""
        try:
            res = self.store.get(
                where={"$and": [{"kind": KIND_HEAL}, {"failed_selector": failed_selector}, {"success": True}]}
            )
        except Exception as exc:
            log.debug("learned_fix lookup failed: %s", exc)
            return None
        for meta in reversed(res.get("metadatas") or []):
            if not page_url or meta.get("page_url", "") in ("", page_url):
                return meta.get("healed_selector")
        return None

    def count(self, kind: str, success_only: bool = False) -> int:
        where: dict = {"kind": kind}
        if success_only:
            where = {"$and": [{"kind": kind}, {"success": True}]}
        try:
            return len(self.store.get(where=where).get("ids") or [])
        except Exception:
            return 0
