import os

from app.llm.base import LLMProvider


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, model: str):
        from langchain_google_genai import ChatGoogleGenerativeAI

        self._api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        self._chat = ChatGoogleGenerativeAI(
            model=model, api_key=self._api_key or "missing-key",
            temperature=0, max_tokens=2048, timeout=30, max_retries=2,
        )

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    def complete(self, system: str, user: str) -> str:
        msg = self._chat.invoke([("system", system), ("human", user)])
        c = msg.content
        return c if isinstance(c, str) else "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in c)