from __future__ import annotations

import logging
from typing import Any

from ..utils.llm import chat_complete

logger = logging.getLogger(__name__)


class BaseAgent:
    def __init__(self, name: str, model: str | None = None) -> None:
        self.name = name
        self.model = model
        self.conversation_history: list[dict[str, str]] = []

    def chat(self, user_input: str, system_prompt: str, **kwargs: Any) -> str:
        """Append ``user_input`` to history, call the LLM, append response, return it.

        LLM errors propagate — the caller (orchestrator / route) decides how to surface them.
        """
        self.conversation_history.append({"role": "user", "content": user_input})
        messages = [{"role": "system", "content": system_prompt}, *self.conversation_history]
        if self.model and "model" not in kwargs:
            kwargs["model"] = self.model
        response = chat_complete(messages, **kwargs)
        self.conversation_history.append({"role": "assistant", "content": response})
        return response

    def get_history(self) -> list[dict[str, str]]:
        return self.conversation_history
