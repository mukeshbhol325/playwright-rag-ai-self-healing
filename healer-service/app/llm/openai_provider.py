import os

from app.llm.base import LLMProvider


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, model: str):
        from langchain_openai import ChatOpenAI  # lazy, optional dependency

        self._chat = ChatOpenAI(model=model, temperature=0)

    @property
    def available(self) -> bool:
        return bool(os.getenv("OPENAI_API_KEY"))

    def complete(self, system: str, user: str) -> str:
        msg = self._chat.invoke([("system", system), ("human", user)])
        return msg.content if isinstance(msg.content, str) else str(msg.content)
