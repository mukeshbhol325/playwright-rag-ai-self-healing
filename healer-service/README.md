# healer-service

FastAPI + LangChain + Chroma service that repairs broken Playwright locators and triages failed tests. See the root `README.md` and `docs/LLD.md`.

```bash
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --port 8000      # interactive API docs at http://localhost:8000/docs
pytest
```
