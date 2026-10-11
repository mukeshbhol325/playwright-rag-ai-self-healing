"""DOM-based locator repair without an LLM.

Idea: the broken selector still carries intent ("customer-first-name" => a first
name field). We turn it into hint tokens, score every visible interactive element
by lexical similarity to those hints, then build a *unique* stable selector for
the best matches (data-testid > id > name > aria-label > title > placeholder >
text > classes), falling back to a positional ``>> nth=i`` selector when the
element cannot be isolated.
"""
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from bs4 import BeautifulSoup, Tag

from app.models.schemas import Candidate

INTERACTIVE = "a, button, input, select, textarea, [role=button], [role=link], [onclick]"

# Words that say little about intent; they count for much less when scoring.
GENERIC = {
    "input", "btn", "button", "field", "form", "customer", "control", "item", "element", "wrapper",
    "container", "page", "new", "old", "link", "main", "content", "section", "primary", "default",
}
# Tokens that are selector syntax, not intent.
SYNTAX = {"text", "role", "css", "xpath", "nth", "has", "contains", "div", "span", "and", "the"}
SYNONYMS = {
    "btn": "button", "pwd": "password", "passwd": "password", "usr": "username", "qty": "quantity",
    "addr": "address", "fname": "firstname", "lname": "lastname", "tel": "telephone", "phone": "telephone",
    "num": "number", "zip": "postcode", "postal": "postcode", "mail": "email",
    "basket": "cart", "trolley": "cart", "bag": "cart",
}
BOOTSTRAP_CLASSES = re.compile(
    r"^(btn(-.*)?|form-.*|col(-.*)?|row|d-.*|m[tbxy]?-\d|p[tbxy]?-\d|text-.*|float-.*|fa(-.*)?|fa-.*|"
    r"w-\d+|container.*|navbar.*|nav-.*|dropdown.*|modal.*|table.*|alert.*|badge.*|list-.*)$"
)
INTERACTIVE_TAGS = {"a", "button", "input", "select", "textarea"}


@dataclass
class ScoredElement:
    el: Tag
    score: float
    matched: list[str] = field(default_factory=list)
    total_hints: int = 0


def _split_camel(text: str) -> str:
    return re.sub(r"([a-z])([A-Z])", r"\1 \2", text)


def _norm(tok: str) -> str:
    return SYNONYMS.get(tok, tok)


def extract_hints(selector: str) -> tuple[list[str], str | None]:
    """Return (hint tokens, expected tag) from a failed selector."""
    sel = selector
    sel = re.sub(r">>\s*nth=-?\d+", " ", sel)
    sel = re.sub(r"\[\s*[\w-]+\s*(?:[~|^$*]?=)?", "[", sel)  # drop attribute *names*, keep values
    sel = re.sub(r":[\w-]+", " ", sel)  # drop pseudo names (:has-text, :nth-child ...)
    sel = re.sub(r"\b(?:text|role|css|xpath)=", " ", sel)
    tokens = re.findall(r"[a-z]+", _split_camel(sel).lower())
    hints: list[str] = []
    for t in tokens:
        t = _norm(t)
        if len(t) < 3 or t in SYNTAX or t in hints:
            continue
        hints.append(t)
    m = re.match(r"\s*(?:css=)?(button|input|select|textarea|a)\b", selector)
    return hints, (m.group(1) if m else None)


def _weight(tok: str) -> float:
    return 0.25 if tok in GENERIC else 1.0


def _tok_sim(h: str, b: str) -> float:
    if h == b:
        return 1.0
    if len(h) >= 3 and len(b) >= 3 and (b.startswith(h) or h.startswith(b)):
        return 0.9
    if len(h) >= 4 and len(b) >= 4 and (h in b or b in h):
        return 0.8
    ratio = SequenceMatcher(None, h, b).ratio()
    return ratio if ratio >= 0.8 else 0.0


def _is_hidden(el: Tag) -> bool:
    if el.name == "input" and (el.get("type") or "").lower() == "hidden":
        return True
    node: Tag | None = el
    for _ in range(8):
        if node is None or not isinstance(node, Tag):
            break
        style = (node.get("style") or "").replace(" ", "").lower()
        if node.has_attr("hidden") or "display:none" in style or "visibility:hidden" in style:
            return True
        node = node.parent if isinstance(node.parent, Tag) else None
    return False


def _blob_tokens(el: Tag) -> set[str]:
    a = el.attrs
    parts: list[str] = [el.name]  # the tag itself ("button") is part of an element's identity
    for key in ("id", "name", "data-testid", "data-test", "data-qa", "aria-label", "title", "placeholder", "alt"):
        v = a.get(key)
        if v:
            parts.append(" ".join(v) if isinstance(v, list) else str(v))
    if el.name == "input" and (a.get("type") or "").lower() in ("submit", "button") and a.get("value"):
        parts.append(str(a["value"]))
    classes = a.get("class") or []
    parts.extend(c for c in classes if not BOOTSTRAP_CLASSES.match(c))
    for key in ("formaction", "href"):
        v = a.get(key)
        if v:
            parts.append(str(v).split("?")[0][-40:] + " " + " ".join(re.findall(r"route=([\w./]+)", str(v))))
    text = el.get_text(" ", strip=True)[:80]
    if text:
        parts.append(text)
    words = re.findall(r"[a-z]+", _split_camel(" ".join(parts)).lower())
    toks = {_norm(w) for w in words if len(w) >= 2}
    # concatenations of adjacent words ("Log in" -> "login", "first" "name" -> "firstname")
    toks |= {_norm(a_ + b_) for a_, b_ in zip(words, words[1:])}
    return toks


def _action_adjust(el: Tag, action: str) -> float | None:
    """Score bonus/penalty for how well the element suits the action.

    Returns None when the element can never perform the action (e.g. fill on a
    button): such elements are excluded rather than merely down-ranked.
    """
    tag = el.name
    typ = (el.get("type") or "").lower()
    if action == "click":
        ok = tag in ("a", "button") or (tag == "input" and typ in ("submit", "button", "checkbox", "radio", "image")) or el.get("role") in ("button", "link")
        return 0.08 if ok else -0.05
    if action == "fill":
        ok = tag == "textarea" or (tag == "input" and typ not in ("checkbox", "radio", "submit", "button", "hidden", "file", "image"))
        return 0.08 if ok else None
    if action == "select":
        return 0.08 if tag == "select" else None
    if action == "check":
        return 0.08 if (tag == "input" and typ in ("checkbox", "radio")) else None
    return 0.0


def _esc(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"')


def _looks_dynamic(v: str) -> bool:
    return bool(re.search(r"\d{5,}|[0-9a-f]{8}-[0-9a-f]{4}", v))


class HeuristicHealer:
    def scan(self, dom: str, failed_selector: str, action: str = "click") -> tuple[BeautifulSoup, list[ScoredElement]]:
        soup = BeautifulSoup(dom, "html.parser")
        hints, expected_tag = extract_hints(failed_selector)
        if not hints:
            return soup, []
        total_w = sum(_weight(h) for h in hints)
        scored: list[ScoredElement] = []
        for el in soup.select(INTERACTIVE):
            if _is_hidden(el) or el.has_attr("disabled"):
                continue
            blob = _blob_tokens(el)
            if not blob:
                continue
            got = 0.0
            matched: list[str] = []
            for h in hints:
                best = max((_tok_sim(h, b) for b in blob), default=0.0)
                if best > 0:
                    got += _weight(h) * best
                    matched.append(h)
            base = got / total_w
            if base <= 0:
                continue
            adj = _action_adjust(el, action)
            if adj is None:
                continue
            adj += 0.05 if expected_tag and el.name == expected_tag else 0.0
            scored.append(ScoredElement(el, max(0.0, min(1.0, base + adj)), matched, len(hints)))
        scored.sort(key=lambda s: s.score, reverse=True)
        return soup, scored

    def heal(self, dom: str, failed_selector: str, action: str = "click", limit: int = 3, min_conf: float = 0.35) -> list[Candidate]:
        soup, scored = self.scan(dom, failed_selector, action)
        return self._to_candidates(soup, scored[: max(limit * 3, 8)], limit, min_conf)

    def _to_candidates(self, soup: BeautifulSoup, scored: list[ScoredElement], limit: int, min_conf: float) -> list[Candidate]:
        out: list[Candidate] = []
        seen: set[str] = set()
        for s in scored:
            selector, positional = self._build_selector(soup, s.el)
            if selector in seen:
                continue
            seen.add(selector)
            conf = round(min(0.97, s.score) - (0.1 if positional else 0.0), 2)
            if conf < min_conf:
                continue
            why = f"Matched {len(s.matched)}/{s.total_hints} intent tokens ({', '.join(s.matched)}) on <{s.el.name}>"
            if positional:
                why += "; selector is positional because the element has no unique attribute"
            out.append(Candidate(selector=selector, confidence=conf, reason=why, source="heuristic"))
            if len(out) >= limit:
                break
        return out

    def digest(self, soup: BeautifulSoup, scored: list[ScoredElement], n: int = 25) -> list[dict]:
        rows = []
        for s in scored[:n]:
            a = s.el.attrs
            rows.append(
                {
                    "tag": s.el.name,
                    "id": a.get("id"),
                    "name": a.get("name"),
                    "type": a.get("type"),
                    "classes": " ".join(a.get("class") or []) or None,
                    "text": s.el.get_text(" ", strip=True)[:60] or None,
                    "aria-label": a.get("aria-label"),
                    "title": a.get("title"),
                    "placeholder": a.get("placeholder"),
                    "data-testid": a.get("data-testid"),
                    "score": round(s.score, 2),
                }
            )
        return [{k: v for k, v in r.items() if v not in (None, "")} for r in rows]

    # ---- selector construction -------------------------------------------------
    def _options(self, el: Tag) -> list[tuple[str, str]]:
        """(playwright selector, soup-checkable selector) in order of stability."""
        tag, a = el.name, el.attrs
        opts: list[tuple[str, str]] = []

        def add(css: str, check: str | None = None) -> None:
            opts.append((css, check or css))

        for attr in ("data-testid", "data-test", "data-qa", "data-cy"):
            if a.get(attr):
                add(f'[{attr}="{_esc(a[attr])}"]')
        el_id = a.get("id")
        if el_id and not _looks_dynamic(el_id):
            add(f"#{el_id}" if re.fullmatch(r"[A-Za-z][\w-]*", el_id) else f'[id="{_esc(el_id)}"]')
        for attr in ("name", "aria-label", "title", "placeholder"):
            if a.get(attr):
                add(f'{tag}[{attr}="{_esc(str(a[attr]))}"]')
        text = el.get_text(" ", strip=True)
        if tag in ("a", "button") and 0 < len(text) <= 40:
            add(f'{tag}:has-text("{_esc(text)}")', f'{tag}:-soup-contains("{_esc(text)}")')
        classes = [c for c in (a.get("class") or []) if not BOOTSTRAP_CLASSES.match(c) and not _looks_dynamic(c)]
        if classes:
            add(tag + "".join(f".{c}" for c in classes[:3]))
        return opts

    def _build_selector(self, soup: BeautifulSoup, el: Tag) -> tuple[str, bool]:
        options = self._options(el)
        for css, check in options:
            try:
                matches = soup.select(check)
            except Exception:
                continue
            if len(matches) == 1 and matches[0] is el:
                return css, False
        for css, check in options:  # positional fallback on the most stable option
            try:
                matches = soup.select(check)
            except Exception:
                continue
            for i, m in enumerate(matches):
                if m is el:
                    return f"{css} >> nth={i}", True
        return self._css_path(el), True

    @staticmethod
    def _css_path(el: Tag) -> str:
        parts: list[str] = []
        node: Tag | None = el
        while node is not None and isinstance(node, Tag) and node.name not in ("[document]", "html"):
            siblings = [s for s in node.parent.find_all(node.name, recursive=False)] if node.parent else [node]
            idx = siblings.index(node) + 1
            parts.append(f"{node.name}:nth-of-type({idx})")
            node = node.parent if isinstance(node.parent, Tag) else None
            if len(parts) >= 5:
                break
        return " > ".join(reversed(parts))
