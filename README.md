# Self-Healing Playwright Framework

UI tests written with **Playwright and TypeScript** that repair their own broken locators.

When a locator stops matching, the framework sends the page DOM and the error to a **Python service** (FastAPI, LangChain, Chroma, optional Gemini) over REST. The service suggests replacements, the framework **checks each suggestion in the live page** before using it, retries the step, and reports exactly what it changed.

Demo target: [saucedemo.com](https://www.saucedemo.com) (login, browse, cart and checkout).

## Features

- **Locator keys, not raw selectors.** Page objects use keys such as `checkout.firstName`; all selectors live in one file, `src/locators/locators.json`.
- **Validated healing.** A suggested locator is used only if it matches exactly one visible element that suits the action.
- **Learns from results.** Successful fixes are stored in a Chroma knowledge base and reused next time.
- **Honest reporting.** Every heal is listed in a report, and a CI gate (`MAX_HEALS`) can fail the build if too many locators were healed.
- **Failure-safe.** If the service is down or slow, tests behave like ordinary Playwright tests.
- **Works offline.** No API key is needed; Gemini is optional.
- **Ships with** Dockerfiles, a Jenkins pipeline and GitHub Actions.

## How it works

1. A test calls a page object. The page object asks `HealingPage` to act on a locator key, which is resolved to a selector.
2. `HealingPage` runs the action with a short timeout (5 s by default).
3. If it fails and the selector does not match exactly one visible element, it sends a privacy-scrubbed DOM snapshot and the error to `POST /heal`.
4. The service looks up earlier successful fixes, scores every visible interactive element against the intent of the broken selector, retrieves similar past repairs, and (if Gemini is configured) lets the model re-rank. It returns up to 3 candidates with confidence scores.
5. The framework keeps candidates with confidence of 0.6 or more, validates each one, retries the action, and reports the result to `POST /feedback`.
6. After the run, failed tests are sent to `POST /failures` for classification (locator drift, assertion, network and so on). Reports are written to `tests-ts/reports/healing/`.

Only element **lookups** are healed, never assertions, so healing cannot hide a real bug.

## Quick start

Requirements: Python 3.11+ and Node 20+.

### 1. Start the healer service

```powershell
cd healer-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --port 8000
```

On macOS or Linux use `source .venv/bin/activate` and `cp .env.example .env`.

Check `http://localhost:8000/health`. Interactive API docs are at `http://localhost:8000/docs`. Run the service tests with `pytest`.

**Gemini is optional.** To use it, put your key in `healer-service/.env`:

```env
GEMINI_API_KEY=your-key
LLM_PROVIDER=gemini
EMBEDDINGS_PROVIDER=gemini
```

To run with no key, set `LLM_PROVIDER=none` and `EMBEDDINGS_PROVIDER=hashing`. The service then uses heuristics, memory and local embeddings. Restart it after changing `.env`.

### 2. Run the tests

```powershell
cd tests-ts
npm install
npx playwright install chromium
copy .env.example .env
```

| Command | What it runs |
|---|---|
| `npm run test:saucedemo` | The Sauce Demo suite: login, browse and sort, cart, checkout information, complete order |
| `npm run typecheck` | TypeScript type check |
| `npm run report` | Open the Playwright HTML report |

After a run, open `tests-ts/reports/healing/healing-report.md` to see what was healed and why.

### See healing in action

Add stale selectors for the login keys to `STALE_SELECTORS` in `src/utils/drift.ts`:

```ts
'sd.login.username': '#user-name-field',
'sd.login.password': '#password-input',
'sd.login.button': '#login-submit-button',
```

With the healer service running, start the suite in drift mode (PowerShell):

```powershell
$env:SIMULATE_DRIFT="true"; npm run test:saucedemo
Remove-Item Env:SIMULATE_DRIFT      # turn it off afterwards
```

The framework replaces those selectors with the stale ones, heals them through the service, and the tests still pass. The healing report shows each original and healed selector.

## Configuration

Settings live in `tests-ts/.env` (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `HEALER_URL` | `http://localhost:8000` | Healer service |
| `HEALING_ENABLED` | `true` | Turn healing on or off |
| `HEAL_ACTION_TIMEOUT_MS` | `5000` | Wait before asking for a heal |
| `MIN_CONFIDENCE` | `0.6` | Ignore candidates below this score |
| `MAX_HEALS` | `-1` | Fail the run if more locators are healed (-1 = no limit) |
| `SIMULATE_DRIFT` | `false` | Break locators on purpose to demo healing |

The Sauce Demo specs use the full site address, so `BASE_URL` does not affect them.

## Project layout

- `tests-ts/` Playwright + TypeScript: `src/pages`, `src/components`, `src/fixtures`, `src/healing`, `src/api`, `src/reporters`, `src/locators`, `tests/`
- `healer-service/` Python service: `app/api`, `app/services`, `app/rag`, `app/llm`, `app/models`, `tests/`
- `Jenkinsfile`, `docker-compose.yml`, `.github/workflows/ci.yml` for delivery

## Docker

```bash
docker compose up --build healer                 # service on :8000
docker compose --profile tests run --rm tests npm run test:saucedemo   # Sauce Demo suite against it
```

Pass `GEMINI_API_KEY` through your shell or a root-level `.env` file; never commit it. The test image tag in `tests-ts/Dockerfile` must match the `@playwright/test` version in `package-lock.json`.

## Jenkins

The `Jenkinsfile` runs natively on a Windows agent (Python, Node and npm on the PATH) or in Docker mode. It needs a Jenkins "Secret text" credential with ID `gemini-api-key`, or untick `USE_GEMINI` to run without a key. Choose the suite with the `SUITE` parameter. Reports are archived on every build.

## Status and limitations

- The service has 37 passing tests. The healing loop was also verified end to end with a real browser against a local mock page.
- The Sauce Demo suite depends on the site's current markup. Five input-field selectors in `locators.json` (`sd.login.username`, `sd.login.password`, `sd.info.firstName`, `sd.info.lastName`, `sd.info.postalCode`) were written from memory and may need a small update on the first run.
- Healing relies on meaningful attributes, text or placeholders in the page, so it works best on markup that keeps some stable identifiers.
- Elements that are only asserted (never clicked or filled) are not healed, by design.
- A heal costs about 5 seconds (the first attempt's timeout). Lower `HEAL_ACTION_TIMEOUT_MS` to speed it up.
