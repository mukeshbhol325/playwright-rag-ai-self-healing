import pytest

from app.services.failure_analyzer import categorize


@pytest.mark.parametrize(
    "error,expected",
    [
        ("Error: strict mode violation: locator('button') resolved to 3 elements", "ambiguous_locator"),
        ("TimeoutError: locator.click: Timeout 5000ms exceeded.\nwaiting for locator('#x')", "locator_drift"),
        ("Error: expect(received).toHaveText(expected)\nExpected: 'a'\nReceived: 'b'", "assertion_failure"),
        ("Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://x", "network_environment"),
        ("Error: Target page, context or browser has been closed", "browser_closed"),
        ("something odd", "unknown"),
    ],
)
def test_categorize(error, expected):
    assert categorize(error)[0] == expected
