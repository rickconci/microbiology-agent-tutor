from __future__ import annotations

from .base_agent import BaseAgent
from ..prompts import FIRST_SENTENCE_GENERATION_PROMPT, PATIENT_SYSTEM_PROMPT
from ..utils.llm import chat_complete


class PatientAgent(BaseAgent):
    def __init__(self, case_data: str, model: str | None = None) -> None:
        super().__init__("patient", model=model)
        self.case_data = case_data
        self.system_prompt = PATIENT_SYSTEM_PROMPT.format(case=self.case_data)
        self.first_sentence = self._generate_first_sentence()

    def _generate_first_sentence(self) -> str:
        """LLM-generated opening line; LLM errors propagate to the caller."""
        prompt = FIRST_SENTENCE_GENERATION_PROMPT.format(case=self.case_data)
        return chat_complete([{"role": "user", "content": prompt}])

    def chat(self, user_input: str) -> str:  # type: ignore[override]
        return super().chat(user_input, self.system_prompt)
