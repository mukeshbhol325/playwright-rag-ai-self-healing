"""Orchestrates healing: memory lookup -> heuristic candidates -> RAG + LLM re-rank."""
import json
import logging
import re

from app.core.config import Settings
from app.llm.base import LLMProvider
from app.models.schemas import Candidate, HealRequest, HealResponse
from app.rag import prompts
from app.rag.vector_store import KIND_HEAL, KnowledgeBase
from app.services.heuristic_healer import HeuristicHealer

log = logging.getLogger(__name__)


def parse_llm_json(raw: str) -> dict:
    """Tolerant JSON extraction: strips code fences and surrounding prose."""
    text = re.sub(r"```(?:json)?", "", raw).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return {}
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}


class RagHealer:
    def __init__(self, kb: KnowledgeBase, heuristic: HeuristicHealer, llm: LLMProvider, settings: Settings):
        self.kb, self.heuristic, self.llm, self.settings = kb, heuristic, llm, settings

    def heal(self, req: HealRequest) -> HealResponse:
        dom = req.dom[: self.settings.max_dom_chars]
        candidates: list[Candidate] = []

        # 1. Exact memory: we already fixed this selector successfully before.
        learned = self.kb.learned_fix(req.failed_selector, req.page_url)
        if learned and learned != req.failed_selector:
            candidates.append(
                Candidate(selector=learned, confidence=0.95, reason="Previously healed successfully for this selector", source="memory")
            )

        # 2. Heuristic scan of the live DOM.
        soup, scored = self.heuristic.scan(dom, req.failed_selector, req.action)
        heuristic = self.heuristic._to_candidates(
            soup, scored[:12], self.settings.max_candidates, self.settings.min_candidate_confidence
        )
        candidates.extend(heuristic)

        # 3. RAG: similar past repairs, then (optionally) LLM re-rank over evidence.
        hits = self.kb.search(f"{req.failed_selector} {req.action} {req.error[:200]}", k=4, kind=KIND_HEAL)
        cases = [d.page_content for d, _ in hits]
        strategy = "memory+heuristic" if learned else "heuristic"

        if self.llm.available and scored:
            llm_candidates = self._llm_rerank(req, soup, scored, heuristic, cases)
            if llm_candidates:
                candidates = llm_candidates + candidates
                strategy = "rag+llm"

        final = self._dedupe(candidates, req.failed_selector)[: self.settings.max_candidates]
        log.info("heal '%s' -> %d candidates via %s", req.failed_selector, len(final), strategy)
        return HealResponse(candidates=final, strategy=strategy, retrieved_cases=len(cases))

    def _llm_rerank(self, req, soup, scored, heuristic, cases) -> list[Candidate]:
        try:
            digest = self.heuristic.digest(soup, scored)
            prompt = prompts.build_heal_prompt(req, digest, [c.model_dump() for c in heuristic], cases)
            data = parse_llm_json(self.llm.complete(prompts.HEAL_SYSTEM, prompt))
            out = []
            for item in data.get("candidates", [])[: self.settings.max_candidates]:
                sel = str(item.get("selector", "")).strip()
                if not sel:
                    continue
                conf = max(0.0, min(1.0, float(item.get("confidence", 0.5))))
                out.append(Candidate(selector=sel, confidence=round(conf, 2), reason=str(item.get("reason", ""))[:300], source="llm"))
            return out
        except Exception as exc:  # LLM problems must never break healing
            log.warning("LLM re-rank failed, using heuristics only: %s", exc)
            return []

    @staticmethod
    def _dedupe(cands: list[Candidate], original: str) -> list[Candidate]:
        seen, out = {original}, []
        for c in cands:
            if c.selector not in seen:
                seen.add(c.selector)
                out.append(c)
        return out
