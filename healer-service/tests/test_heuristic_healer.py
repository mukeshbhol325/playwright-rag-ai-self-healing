from bs4 import BeautifulSoup

from app.services.heuristic_healer import HeuristicHealer, extract_hints

healer = HeuristicHealer()


def top(dom, selector, action):
    cands = healer.heal(dom, selector, action)
    assert cands, f"no candidates for {selector}"
    return cands[0]


def test_hints_ignore_attribute_names_and_pseudos():
    hints, tag = extract_hints('button[title="Add to Cart"]:has-text("Go") >> nth=0')
    assert "title" not in hints and "has" not in hints and "nth" not in hints
    assert {"add", "cart"} <= set(hints) and tag == "button"


def test_heals_renamed_first_name_field(dom):
    c = top(dom, "#customer-first-name", "fill")
    assert c.selector == "#input-firstname"
    assert c.confidence >= 0.6


def test_heals_renamed_email_field(dom):
    assert top(dom, "#customer-email", "fill").selector == "#input-email"


def test_heals_continue_button_by_intent(dom):
    assert top(dom, "#btn-register-continue", "click").selector == "#button-register"


def test_confirm_button(dom):
    assert top(dom, "#confirm-order-btn", "click").selector == "#button-confirm"


def test_ambiguous_add_to_cart_becomes_positional_with_lower_confidence(dom):
    c = top(dom, "button.btn-add-to-cart-v1", "click")
    assert c.selector.endswith(">> nth=0")
    assert 'Add to Cart' in c.selector
    assert 0.6 <= c.confidence < 0.95  # positional selectors are trusted a little less


def test_fill_action_only_proposes_fillable_elements(dom):
    soup = BeautifulSoup(dom, "html.parser")
    cands = healer.heal(dom, "#continue-register", "fill")
    for cand in cands:
        el = soup.select_one(cand.selector.split(" >> nth=")[0])
        assert el is not None and el.name in ("input", "textarea"), cand.selector


def test_hidden_inputs_are_never_proposed(dom):
    assert all("token" not in c.selector for c in healer.heal(dom, "#token-field", "fill"))


def test_no_hints_returns_empty(dom):
    assert healer.heal(dom, "div > a:nth-child(2)", "click") == []


# The stale selectors used by the drift demo (tests-ts/src/utils/drift.ts) must all be
# healable above the client's 0.6 confidence threshold, otherwise the demo silently fails.
import pytest


@pytest.mark.parametrize(
    "stale,action,expected",
    [
        ("button.btn-add-to-basket-v1", "click", 'button[title="Add to Cart"] >> nth=0'),
        ("#customer-email", "fill", "#input-email"),
        ("#customer-address", "fill", "#input-shipping-address-1"),
        ("#btn-register-continue", "click", "#button-register"),
        ("#btn-confirm-order", "click", "#button-confirm"),
    ],
)
def test_drift_demo_selectors_heal_above_threshold(dom, stale, action, expected):
    c = healer.heal(dom, stale, action)[0]
    assert c.selector == expected
    assert c.confidence >= 0.6
