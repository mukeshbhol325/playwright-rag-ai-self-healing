# tests-ts

Playwright + TypeScript UI tests with self-healing locators. See the root `README.md`.

```bash
npm install && npx playwright install chromium && cp .env.example .env
npm run test:smoke | test:e2e | test:healing | test:offline | test:drift
```

Edit `src/locators/locators.json` when the application's markup changes; page objects only reference keys.
