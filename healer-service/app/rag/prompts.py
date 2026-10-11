"""Prompt builders. The LLM only re-ranks/chooses among evidence we supply."""
import json

HEAL_SYSTEM = (
    "You are a senior test-automation engineer repairing a broken Playwright locator. "
    "You are given the failed selector, the action being performed, the error, a digest of the "
    "interactive elements currently on the page, and similar past repairs. "
    "Choose the element the test most likely intended and return ONLY JSON of the form "
    '{"candidates":[{"selector":"...","confidence":0.0,"reason":"..."}]} with at most 3 candidates, '
    "best first. Selectors must be valid Playwright CSS selectors that match exactly one element and "
    "must be built only from attributes present in the digest. Prefer data-testid, id, name, "
    "aria-label, then text. Never invent attributes. Confidence is between 0 and 1."
)

FAILURE_SYSTEM = (
    "You are a senior SDET triaging a failed UI test. Using the error and similar past failures, "
    'return ONLY JSON: {"summary":"one or two sentences on the likely root cause",'
    '"suggested_fix":"one concrete next step"}.'
)


def build_heal_prompt(req, digest: list[dict], heuristic: list[dict], cases: list[str]) -> str:
    return "\n".join(
        [
            f"Test: {req.test_name}",
            f"Action: {req.action}",
            f"Failed selector: {req.failed_selector}",
            f"Page URL: {req.page_url}",
            f"Error: {req.error[:600]}",
            "",
            "Interactive elements on the page (best lexical matches first):",
            json.dumps(digest, ensure_ascii=False),
            "",
            "Heuristic candidates already found:",
            json.dumps(heuristic, ensure_ascii=False),
            "",
            "Similar past repairs (retrieved from knowledge base):",
            "\n".join(f"- {c}" for c in cases) or "- none",
        ]
    )


def build_failure_prompt(report, category: str, cases: list[str]) -> str:
    return "\n".join(
        [
            f"Test: {report.test_name} ({report.file})",
            f"Rule-based category: {category}",
            f"Failed selector: {report.failed_selector or 'n/a'}",
            f"Error: {report.error[:1200]}",
            "",
            "Similar past failures:",
            "\n".join(f"- {c}" for c in cases) or "- none",
        ]
    )
