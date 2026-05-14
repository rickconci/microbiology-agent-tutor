"""Thin OpenAI chat-completion wrapper.

LLM errors are logged with full traceback and re-raised — never swallowed.
"""

from __future__ import annotations

import logging

from openai import OpenAI

from ..config.config import config

logger = logging.getLogger(__name__)

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    """Lazy-init the OpenAI client so importing this module never fails."""
    global _client
    if _client is None:
        if not config.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not set; cannot create OpenAI client.")
        _client = OpenAI(api_key=config.OPENAI_API_KEY)
    return _client


def chat_complete(
    messages: list[dict],
    model: str = config.MODEL_NAME,
    temperature: float = 0.7,
    max_tokens: int = 1000,
    response_format: dict | None = None,
) -> str:
    """Call OpenAI chat-completion and return the assistant's text content.

    Raises whatever the OpenAI SDK raises (``openai.OpenAIError`` and subclasses)
    — callers must decide how to recover.
    """
    del temperature, max_tokens  # not currently forwarded; preserved for API stability
    kwargs: dict = {"model": model, "messages": messages}
    if response_format:
        kwargs["response_format"] = response_format
    try:
        response = _get_client().chat.completions.create(**kwargs)
    except Exception:
        logger.exception("LLM call failed (model=%s, n_messages=%s)", model, len(messages))
        raise
    return response.choices[0].message.content
