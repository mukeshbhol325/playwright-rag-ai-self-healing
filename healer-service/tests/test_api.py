def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["llm_available"] is False


def test_heal_returns_ranked_candidates(client, dom):
    res = client.post("/heal", json={
        "test_name": "guest checkout", "action": "fill", "failed_selector": "#customer-first-name",
        "error": "Timeout 5000ms exceeded", "page_url": "https://demo.opencart.com/checkout", "dom": dom,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["candidates"][0]["selector"] == "#input-firstname"
    assert body["strategy"] == "heuristic"


def test_feedback_makes_the_fix_a_memory_candidate(client, dom):
    payload = {"test_name": "t", "action": "fill", "failed_selector": "#legacy-name-box",
               "error": "", "page_url": "https://demo.opencart.com/checkout", "dom": dom}
    assert client.post("/heal", json=payload).json()["strategy"] == "heuristic"

    fb = {"test_name": "t", "failed_selector": "#legacy-name-box", "healed_selector": "#input-firstname",
          "success": True, "page_url": "https://demo.opencart.com/checkout"}
    assert client.post("/feedback", json=fb).json()["stored"] is True

    again = client.post("/heal", json=payload).json()
    assert again["strategy"] == "memory+heuristic"
    assert again["candidates"][0]["source"] == "memory"
    assert again["candidates"][0]["selector"] == "#input-firstname"


def test_failed_feedback_is_not_reused_as_a_fix(client, dom):
    client.post("/feedback", json={"failed_selector": "#a-b-c", "healed_selector": "#wrong", "success": False})
    res = client.post("/heal", json={"failed_selector": "#a-b-c", "action": "click", "dom": dom}).json()
    assert all(c["source"] != "memory" for c in res["candidates"])


def test_failures_endpoint_classifies_and_remembers(client):
    report = {"test_name": "checkout", "file": "tests/e2e/checkout.spec.ts", "status": "failed",
              "error": "TimeoutError: waiting for locator('#button-confirm')", "failed_selector": "#button-confirm"}
    first = client.post("/failures", json=report).json()
    assert first["category"] == "locator_drift" and first["similar_cases"] == []
    second = client.post("/failures", json=report).json()
    assert len(second["similar_cases"]) >= 1


def test_stats(client, dom):
    client.post("/feedback", json={"failed_selector": "#x-y", "healed_selector": "#z", "success": True})
    stats = client.get("/stats").json()
    assert stats["heal_records"] == 1 and stats["successful_heals"] == 1
