"""Classifies failed tests from the Playwright report and suggests next steps."""
import logging
import re

from app.llm.base import LLMProvider
from app.models.schemas import FailureAnalysis, FailureReport, SimilarCase
from app.rag import prompts
from app.rag.vector_store import KIND_FAILURE, KnowledgeBase
from app.services.rag_healer import parse_llm_json

log = logging.getLogger(__name__)

# (category, regex over the error text, suggested fix) - first match wins.
RULES: list[tuple[str, str, str]] = [
    ("ambiguous_locator", r"strict mode violation", "The locator matches several elements. Scope it to a container or use a unique attribute (data-testid, id)."),
    ("network_environment", r"net::ERR|ECONNREFUSED|ENOTFOUND|getaddrinfo|Failed to fetch|ERR_NAME_NOT_RESOLVED|50[234]\b", "The app or network was unreachable. Check the environment/URL and re-run; consider a health-check before the suite."),
    ("browser_closed", r"Target page, context or browser has been closed", "The page closed mid-test. Look for a crash, an earlier timeout, or a test ending before async work finished."),
    ("navigation_timeout", r"(page\.goto|waitForURL|waitForLoadState|navigat\w+).*(timeout|exceeded)|(timeout|exceeded).*(page\.goto|waitForURL|navigat)", "Navigation was too slow or never completed. Verify the URL/redirects and raise the navigation timeout only if the app is genuinely slow."),
    ("locator_drift", r"waiting for (locator|selector)|Element is not (visible|attached)|element\(s\) not found|Timeout .* exceeded", "The element was not found in time. The locator probably changed: let the healer propose a replacement, then update the locator registry."),
    ("assertion_failure", r"expect\(|toHave\w+|toBe\w+|Expected|Received", "The page loaded but the value differs from the expectation. Check test data and whether the product behaviour changed."),
]


def categorize(error: str) -> tuple[str, str]:
    for category, pattern, fix in RULES:
        if re.search(pattern, error, re.IGNORECASE | re.DOTALL):
            return category, fix
    return "unknown", "No known pattern. Inspect the trace and screenshot attached to the test."


class FailureAnalyzer:
    def __init__(self, kb: KnowledgeBase, llm: LLMProvider):
        self.kb, self.llm = kb, llm

    def analyze(self, report: FailureReport) -> FailureAnalysis:
        category, fix = categorize(report.error)
        first_line = next((ln.strip() for ln in report.error.splitlines() if ln.strip()), "no error message")[:200]
        query = f"{category} {report.failed_selector or ''} {first_line}"

        hits = self.kb.search(query, k=3, kind=KIND_FAILURE)
        similar = [SimilarCase(summary=d.page_content[:200], score=round(float(s), 3)) for d, s in hits]

        summary = f"{category.replace('_', ' ').capitalize()}: {first_line}"
        used_llm = False
        if self.llm.available:
            try:
                prompt = prompts.build_failure_prompt(report, category, [c.summary for c in similar])
                data = parse_llm_json(self.llm.complete(prompts.FAILURE_SYSTEM, prompt))
                if data.get("summary"):
                    summary, used_llm = str(data["summary"]), True
                    fix = str(data.get("suggested_fix") or fix)
            except Exception as exc:
                log.warning("LLM failure analysis failed, using rules: %s", exc)

        self.kb.add(
            f"{category} in '{report.test_name}': {first_line}",
            {"kind": KIND_FAILURE, "category": category, "test_name": report.test_name, "failed_selector": report.failed_selector or ""},
        )
        return FailureAnalysis(category=category, summary=summary, suggested_fix=fix, similar_cases=similar, used_llm=used_llm)
