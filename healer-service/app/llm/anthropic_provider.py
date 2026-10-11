import os

from app.llm.base import LLMProvider


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, model: str):
        from langchain_anthropic import ChatAnthropic  # lazy, optional dependency

        self._chat = ChatAnthropic(model=model, temperature=0, max_tokens=1024)

    @property
    def available(self) -> bool:
        return bool(os.getenv("ANTHROPIC_API_KEY"))

    def complete(self, system: str, user: str) -> str:
        msg = self._chat.invoke([("system", system), ("human", user)])
        return msg.content if isinstance(msg.content, str) else "".join(
            part.get("text", "") for part in msg.content if isinstance(part, dict)
        )
