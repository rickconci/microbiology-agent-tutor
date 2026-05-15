"""Thin chat-completion wrapper for OpenAI or Azure OpenAI.

Uses ``USE_AZURE_OPENAI``. LLM errors are logged with full traceback and re-raised.
"""

from __future__ import annotations

import logging
from typing import Union

from openai import AzureOpenAI, OpenAI

from ..config.config import config

logger = logging.getLogger(__name__)

_client: Union[OpenAI, AzureOpenAI, None] = None


def _get_client() -> Union[OpenAI, AzureOpenAI]:
    """Lazy-init client; Azure uses deployment names as ``model``."""
    global _client
    if _client is not None:
        return _client

    if config.USE_AZURE_OPENAI:
        if not config.AZURE_OPENAI_ENDPOINT or not config.AZURE_OPENAI_API_KEY:
            raise RuntimeError(
                "USE_AZURE_OPENAI=true but AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY is missing."
            )
        endpoint = config.AZURE_OPENAI_ENDPOINT.rstrip("/")
        _client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=config.AZURE_OPENAI_API_KEY,
            api_version=config.AZURE_OPENAI_API_VERSION,
        )
        logger.info("LLM client: Azure OpenAI (%s, api_version=%s)", endpoint, config.AZURE_OPENAI_API_VERSION)
        return _client

    if not config.OPENAI_API_KEY:
        raise RuntimeError("USE_AZURE_OPENAI=false but OPENAI_API_KEY is not set.")
    _client = OpenAI(api_key=config.OPENAI_API_KEY)
    logger.info("LLM client: OpenAI (personal key)")
    return _client


def chat_complete(
    messages: list[dict],
    model: str = config.MODEL_NAME,
    temperature: float = 0.7,
    max_tokens: int = 1000,
    response_format: dict | None = None,
) -> str:
    """Call chat completions; ``model`` is an Azure deployment ID or OpenAI model name."""
    del temperature, max_tokens  # preserved for API stability with callers
    kwargs: dict = {"model": model, "messages": messages}
    if response_format:
        kwargs["response_format"] = response_format
    try:
        response = _get_client().chat.completions.create(**kwargs)
    except Exception:
        logger.exception("LLM call failed (model=%s, n_messages=%s)", model, len(messages))
        raise
    return response.choices[0].message.content
