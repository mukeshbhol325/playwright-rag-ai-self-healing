from abc import ABC, abstractmethod


class LLMProvider(ABC):
    name: str = "base"

    @property
    @abstractmethod
    def available(self) -> bool:
        """True when the provider is configured and can be called."""

    @abstractmethod
    def complete(self, system: str, user: str) -> str:
        """Return the raw text completion."""
