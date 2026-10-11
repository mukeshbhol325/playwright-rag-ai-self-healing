"""Embeddings for the RAG layer.

Default is an offline signed feature-hashing embedding (tokens + bigrams), so
the service runs with no API key. It is lexical rather than semantic, which
suits selectors, DOM attributes and error messages. Set
EMBEDDINGS_PROVIDER=openai for real semantic embeddings.
"""
import hashlib
import math
import re
import logging
import os

from langchain_core.embeddings import Embeddings

from app.core.config import Settings

log = logging.getLogger(__name__)
class HashingEmbeddings(Embeddings):
    def __init__(self, dim: int = 384):
        self.dim = dim

    def _embed(self, text: str) -> list[float]:
        spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
        tokens = re.findall(r"[a-z0-9]+", spaced.lower())
        feats = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:])]
        vec = [0.0] * self.dim
        for feat in feats:
            h = int(hashlib.md5(feat.encode()).hexdigest(), 16)
            vec[h % self.dim] += 1.0 if (h >> 64) & 1 else -1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)


def build_embeddings(settings: Settings) -> tuple[Embeddings, str]:
    if settings.embeddings_provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            log.warning("GEMINI_API_KEY not set; falling back to offline hashing embeddings")
        else:
            try:
                from langchain_google_genai import GoogleGenerativeAIEmbeddings

                return GoogleGenerativeAIEmbeddings(model=settings.gemini_embedding_model, api_key=api_key), "gemini"
            except Exception as exc:
                log.warning("Gemini embeddings unavailable (%s); using hashing", exc)
    return HashingEmbeddings(), "hashing"
