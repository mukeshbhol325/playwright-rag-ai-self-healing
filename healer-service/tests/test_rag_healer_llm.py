import json

from app.core.config import Settings
from app.llm.base import LLMProvider
from app.models.schemas import HealRequest
from app.rag.vector_store import KnowledgeBase
from app.services.heuristic_healer import HeuristicHealer
from app.services.rag_healer import RagHealer, parse_llm_json


class FakeLLM(LLMProvider):
    name = "fake"

    def __init__(self, reply: str, available: bool = True):
        self.reply, self._available, self.prompts = reply, available, []

    @property
    def available(self) -> bool:
        return self._available

    def complete(self, system: str, user: str) -> str:
        self.prompts.append(user)
        return self.reply


def make(tmp_path, llm):
    settings = Settings(kb_dir=str(tmp_path / "kb"))
    return RagHealer(KnowledgeBase(settings), HeuristicHealer(), llm, settings)


def req(dom):
    return HealRequest(test_name="t", action="fill", failed_selector="#customer-first-name", dom=dom)


def test_parse_llm_json_handles_fences_and_prose():
    raw = 'Sure!\n```json\n{"candidates":[{"selector":"#a","confidence":0.9}]}\n```'
    assert parse_llm_json(raw)["candidates"][0]["selector"] == "#a"
    assert parse_llm_json("no json here") == {}
    assert parse_llm_json("{broken") == {}


def test_llm_candidates_come_first_and_prompt_has_evidence(tmp_path, dom):
    reply = json.dumps({"candidates": [{"selector": "#input-firstname", "confidence": 0.93, "reason": "first name field"}]})
    llm = FakeLLM(reply)
    res = make(tmp_path, llm).heal(req(dom))
    assert res.strategy == "rag+llm"
    assert res.candidates[0].source == "llm" and res.candidates[0].selector == "#input-firstname"
    assert "#customer-first-name" in llm.prompts[0] and "input-firstname" in llm.prompts[0]
    assert len({c.selector for c in res.candidates}) == len(res.candidates)  # deduped


def test_garbage_llm_output_falls_back_to_heuristics(tmp_path, dom):
    res = make(tmp_path, FakeLLM("I cannot help with that")).heal(req(dom))
    assert res.strategy == "heuristic" and res.candidates[0].selector == "#input-firstname"


def test_llm_exception_never_breaks_healing(tmp_path, dom):
    class Boom(FakeLLM):
        def complete(self, system, user):
            raise TimeoutError("api down")

    res = make(tmp_path, Boom("")).heal(req(dom))
    assert res.candidates and res.strategy == "heuristic"
